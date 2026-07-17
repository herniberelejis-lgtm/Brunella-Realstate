import type { Propiedad } from "../domain/propiedades";
import type { Busqueda } from "../domain/busquedas";
import type { Contacto } from "../domain/contactos";
import { buildMatchReason } from "./propertyMatching";
import { parseImagenes } from "../view/imagenes";

type TelegramDeps = {
  sendMediaGroup: (chatId: number, photos: { url: string; caption?: string }[]) => Promise<void>;
  sendMessage: (chatId: number, text: string, options?: { reply_markup?: unknown }) => Promise<void>;
};

type WhatsAppDeps = {
  sendWhatsAppImage: (to: string, imageUrl: string, caption: string) => Promise<void>;
  sendWhatsAppText: (to: string, text: string) => Promise<void>;
};

function buildResumenTexto(contacto: Contacto, matches: Propiedad[], busqueda: Busqueda): string {
  const lineas = matches.map(
    (p) => `- ${p.direccion}: ${buildMatchReason(p, busqueda)}`
  );
  return `Propiedades para ${contacto.nombre}:\n${lineas.join("\n")}`;
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
      `Sin matches por ahora para la búsqueda de ${contacto.nombre} — quedó guardada, avisame cuando cargues algo que pueda servirle.`
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
