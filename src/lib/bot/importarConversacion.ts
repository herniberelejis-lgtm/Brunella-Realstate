import { extractConversacionImportada } from "../groq/client";
import type { createContactosModule } from "../domain/contactos";
import type { createConversacionesModule } from "../domain/conversaciones";

export type ImportarConversacionDeps = {
  extractConversacionImportada: typeof extractConversacionImportada;
  contactos: ReturnType<typeof createContactosModule>;
  conversaciones: ReturnType<typeof createConversacionesModule>;
};

export async function importarConversacionWhatsApp(
  deps: ImportarConversacionDeps,
  textoConversacion: string,
  nombre: string,
  telefono: string
): Promise<{ respuesta: string }> {
  const extracted = await deps.extractConversacionImportada(textoConversacion);

  if (extracted.confianza === "baja") {
    return {
      respuesta: `No pude leer bien esa conversación de "${nombre}" — ¿era un .txt exportado de WhatsApp? Probá de nuevo o cargalo a mano.`,
    };
  }

  let contacto = await deps.contactos.findByTelefono(telefono);
  if (!contacto) {
    contacto = await deps.contactos.create({
      nombre,
      telefono,
      fuente: "Otro",
      tipo: extracted.tipoCliente ?? "Comprador",
      etapa: "Nuevo",
      temperatura: "Tibio",
    });
  }

  await deps.conversaciones.create({
    contacto_id: contacto.id,
    canal: "WhatsApp",
    resumen: extracted.resumen,
    proximo_paso: null,
    origen: "importado_whatsapp",
  });

  await deps.contactos.marcarActividad(contacto.id);

  const detalle: string[] = [];
  if (extracted.tipoCliente) detalle.push(`tipo: ${extracted.tipoCliente}`);
  if (extracted.zonaMencionada) detalle.push(`zona: ${extracted.zonaMencionada}`);
  if (extracted.tipoPropiedadMencionada) detalle.push(`propiedad: ${extracted.tipoPropiedadMencionada}`);

  return {
    respuesta: `✅ Importé la conversación de ${contacto.nombre}${
      detalle.length > 0 ? ` (${detalle.join(", ")})` : ""
    }.\nResumen: ${extracted.resumen}`,
  };
}
