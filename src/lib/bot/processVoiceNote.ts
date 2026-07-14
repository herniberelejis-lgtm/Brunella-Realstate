import { transcribeAudio, extractStructuredData, type ExtractedNote } from "../groq/client";
import { matchContacto, matchPropiedad } from "./matching";
import type { createContactosModule } from "../domain/contactos";
import type { createPropiedadesModule } from "../domain/propiedades";
import type { createConversacionesModule } from "../domain/conversaciones";
import type { createMuestrasModule } from "../domain/muestras";
import type { createConsultasModule } from "../domain/consultas";
import type { createOfertasModule } from "../domain/ofertas";

export type ProcessVoiceNoteDeps = {
  transcribeAudio: typeof transcribeAudio;
  extractStructuredData: typeof extractStructuredData;
  contactos: ReturnType<typeof createContactosModule>;
  propiedades: ReturnType<typeof createPropiedadesModule>;
  conversaciones: ReturnType<typeof createConversacionesModule>;
  muestras: ReturnType<typeof createMuestrasModule>;
  consultas: ReturnType<typeof createConsultasModule>;
  ofertas: ReturnType<typeof createOfertasModule>;
};

const CLARIFICATION_MESSAGE =
  "No estoy segura de haber entendido bien esa nota. ¿Podés repetirla o mandarme un resumen escrito?";

function buildAmbiguityMessage(
  nombreODireccion: string,
  opciones: { nombre?: string; direccion?: string }[]
) {
  const lista = opciones.map((o) => `- ${o.nombre ?? o.direccion}`).join("\n");
  return `Encontré más de una coincidencia para "${nombreODireccion}":\n${lista}\n¿A cuál te referís? Contame de nuevo con más detalle.`;
}

export async function processVoiceNote(
  deps: ProcessVoiceNoteDeps,
  audioBuffer: Buffer,
  filename: string
): Promise<{ respuesta: string }> {
  const transcript = await deps.transcribeAudio(audioBuffer, filename);

  const [contactosConocidos, propiedadesConocidas] = await Promise.all([
    deps.contactos.list(),
    deps.propiedades.list(),
  ]);

  const extracted: ExtractedNote = await deps.extractStructuredData(transcript, {
    contactosConocidos: contactosConocidos.map((c) => ({ id: c.id, nombre: c.nombre })),
    propiedadesConocidas: propiedadesConocidas.map((p) => ({ id: p.id, direccion: p.direccion })),
  });

  if (extracted.confianza === "baja") {
    return { respuesta: CLARIFICATION_MESSAGE };
  }

  const contactoCandidatos = extracted.contactoNombreMencionado
    ? await deps.contactos.findByNombreLike(extracted.contactoNombreMencionado)
    : [];
  const contactoMatch = matchContacto(extracted.contactoNombreMencionado, contactoCandidatos);

  if (contactoMatch.type === "ambiguo") {
    return {
      respuesta: buildAmbiguityMessage(extracted.contactoNombreMencionado!, contactoMatch.candidatos),
    };
  }
  if (contactoMatch.type === "sin_match") {
    return {
      respuesta:
        "No encontré ningún contacto que coincida con esa nota. Si es alguien nuevo, contame su nombre completo y de dónde viene (Instagram, Facebook, portal, referido) para cargarlo.",
    };
  }

  const contacto = contactoMatch.item;

  const propiedadCandidatos = extracted.propiedadMencionada
    ? await deps.propiedades.findByDireccionLike(extracted.propiedadMencionada)
    : [];
  const propiedadMatch = matchPropiedad(extracted.propiedadMencionada, propiedadCandidatos);

  if (propiedadMatch.type === "ambiguo") {
    return {
      respuesta: buildAmbiguityMessage(extracted.propiedadMencionada!, propiedadMatch.candidatos),
    };
  }

  const propiedadId = propiedadMatch.type === "unico" ? propiedadMatch.item.id : null;

  switch (extracted.tipoEvento) {
    case "muestra":
      await deps.muestras.create({
        contacto_id: contacto.id,
        propiedad_id: propiedadId,
        propiedad_mostrada_texto: propiedadId ? null : extracted.propiedadMencionada,
        feedback: extracted.feedback,
        interes_resultante: null,
      } as any);
      break;
    case "consulta":
      if (propiedadId) {
        await deps.consultas.create({
          propiedad_id: propiedadId,
          contacto_id: contacto.id,
          canal: "Otro",
          origen: "nota_de_voz",
        } as any);
      }
      break;
    case "oferta":
      if (propiedadId && extracted.montoOferta) {
        await deps.ofertas.create({
          propiedad_id: propiedadId,
          contacto_id: contacto.id,
          monto: extracted.montoOferta,
          estado: "Pendiente",
          origen: "nota_de_voz",
        } as any);
      }
      break;
    default:
      await deps.conversaciones.create({
        contacto_id: contacto.id,
        canal: "Otro",
        resumen: extracted.feedback ?? transcript,
        proximo_paso: extracted.proximoPaso,
        origen: "nota_de_voz",
      } as any);
  }

  await deps.contactos.marcarActividad(contacto.id);

  return {
    respuesta: `✅ Guardé: ${contacto.nombre} — ${extracted.tipoEvento}${
      extracted.proximoPaso ? `. Próximo paso: ${extracted.proximoPaso}` : ""
    }`,
  };
}
