import type { Propiedad } from "../domain/propiedades";
import type { Busqueda } from "../domain/busquedas";
import type { Contacto } from "../domain/contactos";
import { buildMatchReason } from "./propertyMatching";
import { parseImagenes } from "../view/imagenes";
import { CARACTERISTICAS_OPCIONES } from "../view/leadForm";

const CARACTERISTICAS_LABEL: Record<string, string> = Object.fromEntries(
  CARACTERISTICAS_OPCIONES.map((opcion) => [opcion.value, opcion.label])
);

type TelegramDeps = {
  sendMediaGroup: (chatId: number, photos: { url: string; caption?: string }[]) => Promise<void>;
  sendMessage: (chatId: number, text: string, options?: { reply_markup?: unknown }) => Promise<void>;
};

type WhatsAppDeps = {
  sendWhatsAppImage: (to: string, imageUrl: string, caption: string) => Promise<void>;
  sendWhatsAppText: (to: string, text: string) => Promise<void>;
};

const TIPO_OPERACION_LABEL: Record<Busqueda["tipo_operacion"], string> = {
  Compra: "Comprar",
  Alquiler: "Alquilar",
  Inversion: "Inversión",
};

function buildBusquedaDetalle(contacto: Contacto, busqueda: Busqueda): string {
  const lineas = [
    `Contacto: ${contacto.nombre} (${contacto.telefono ?? "sin teléfono"})`,
    `Operación: ${TIPO_OPERACION_LABEL[busqueda.tipo_operacion]}`,
  ];
  if (busqueda.tipo_propiedad) lineas.push(`Tipo de propiedad: ${busqueda.tipo_propiedad}`);
  if (busqueda.zona) lineas.push(`Zona: ${busqueda.zona}`);
  if (busqueda.presupuesto_min != null || busqueda.presupuesto_max != null) {
    const min = busqueda.presupuesto_min ?? "sin mínimo";
    const max = busqueda.presupuesto_max ?? "sin máximo";
    lineas.push(`Presupuesto: ${busqueda.moneda ?? ""} ${min} - ${max}`.trim());
  }
  if (busqueda.dormitorios != null) lineas.push(`Dormitorios mínimos: ${busqueda.dormitorios}`);
  if (busqueda.ambientes != null) lineas.push(`Ambientes mínimos: ${busqueda.ambientes}`);
  if (busqueda.banos != null) lineas.push(`Baños mínimos: ${busqueda.banos}`);
  if ((busqueda.caracteristicas ?? []).length > 0) {
    const labels = busqueda.caracteristicas
      .map((clave) => CARACTERISTICAS_LABEL[clave] ?? clave)
      .join(", ");
    lineas.push(`Características importantes: ${labels}`);
  }
  if (busqueda.otros_requisitos) lineas.push(`Otros requisitos: ${busqueda.otros_requisitos}`);
  return lineas.join("\n");
}

function buildResumenTexto(contacto: Contacto, matches: Propiedad[], busqueda: Busqueda): string {
  const lineas = matches.map(
    (p) => `- ${p.direccion}: ${buildMatchReason(p, busqueda)}`
  );
  return `${buildBusquedaDetalle(contacto, busqueda)}\n\nPropiedades que matchean:\n${lineas.join("\n")}`;
}

export async function notificarBrunellaCompatibilidad(
  deps: TelegramDeps,
  chatId: number,
  contacto: Contacto,
  busqueda: Busqueda,
  matches: Propiedad[]
): Promise<void> {
  if (matches.length === 0) {
    await deps.sendMessage(
      chatId,
      `Sin matches por ahora en tu portfolio para esta búsqueda:\n\n${buildBusquedaDetalle(contacto, busqueda)}\n\nQuedó guardada — avisame cuando cargues algo que pueda servirle.`
    );
    return;
  }

  const fotos = matches
    .flatMap((p) => parseImagenes(p.imagenes).slice(0, 1).map((url) => ({ url, caption: p.direccion })));
  if (fotos.length > 0) {
    await deps.sendMediaGroup(chatId, fotos);
  }

  await deps.sendMessage(chatId, buildResumenTexto(contacto, matches, busqueda), {
    reply_markup: {
      inline_keyboard: [[{ text: "Aprobar y enviar", callback_data: `aprobar_busqueda:${busqueda.id}` }]],
    },
  });
}

export async function enviarPorWhatsApp(
  deps: WhatsAppDeps,
  telefono: string,
  contacto: Contacto,
  busqueda: Busqueda,
  matches: Propiedad[]
): Promise<void> {
  for (const propiedad of matches) {
    const foto = parseImagenes(propiedad.imagenes)[0];
    const caption = `${propiedad.direccion} — ${buildMatchReason(propiedad, busqueda)}`;
    if (foto) {
      await deps.sendWhatsAppImage(telefono, foto, caption);
    } else {
      await deps.sendWhatsAppText(telefono, caption);
    }
  }
  await deps.sendWhatsAppText(
    telefono,
    `Estas son las propiedades que mejor matchean con lo que buscás, ${contacto.nombre}. ¡Cualquier consulta, escribime!`
  );
}
