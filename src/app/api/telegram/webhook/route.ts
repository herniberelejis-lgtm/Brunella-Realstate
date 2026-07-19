import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import {
  verifyWebhookSecret,
  getFileDownloadUrl,
  downloadFile,
  sendMessage,
} from "@/lib/telegram/client";
import { processVoiceNote } from "@/lib/bot/processVoiceNote";
import { importarConversacionWhatsApp } from "@/lib/bot/importarConversacion";
import { transcribeAudio, extractStructuredData, extractConversacionImportada } from "@/lib/groq/client";
import { getPool } from "@/lib/db/pool";
import { createContactosModule } from "@/lib/domain/contactos";
import { createPropiedadesModule } from "@/lib/domain/propiedades";
import { createConversacionesModule } from "@/lib/domain/conversaciones";
import { createMuestrasModule } from "@/lib/domain/muestras";
import { createConsultasModule } from "@/lib/domain/consultas";
import { createOfertasModule } from "@/lib/domain/ofertas";
import { enviarDocumentoAprobado } from "@/lib/bot/enviarDocumentoAprobado";
import { getDomainModules } from "@/lib/domain/factory";

// Default serverless function timeout (10s on Vercel Hobby) is too short for
// download + transcribe + LLM extraction + DB writes in sequence.
export const maxDuration = 60;

const telegramUpdateSchema = z.object({
  message: z
    .object({
      chat: z.object({ id: z.number() }),
      text: z.string().optional(),
      caption: z.string().optional(),
      voice: z.object({ file_id: z.string() }).optional(),
      document: z.object({ file_id: z.string() }).optional(),
    })
    .optional(),
  callback_query: z
    .object({
      id: z.string(),
      data: z.string(),
      from: z.object({ id: z.number() }),
      message: z.object({ chat: z.object({ id: z.number() }) }),
    })
    .optional(),
});

function isFromAdmin(chatId: number): boolean {
  const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (!adminChatId) return false;
  return chatId === Number(adminChatId);
}

// Expects "Nombre, Teléfono" (or "Nombre; Teléfono") as the caption on an imported WhatsApp
// export — the .txt itself rarely carries a phone number, only the display name from the
// sender's own contact list, so the admin has to supply it explicitly.
function parseImportCaption(caption: string): { nombre: string; telefono: string } | null {
  const separator = caption.includes(";") ? ";" : caption.includes(",") ? "," : null;
  if (!separator) return null;
  const [nombrePart, telefonoPart] = caption.split(separator);
  const nombre = nombrePart?.trim();
  const telefono = telefonoPart?.trim();
  if (!nombre || !telefono) return null;
  return { nombre, telefono };
}

export async function POST(request: NextRequest) {
  const secretHeader = request.headers.get("x-telegram-bot-api-secret-token");
  if (!verifyWebhookSecret(secretHeader)) {
    return NextResponse.json({ error: "invalid secret" }, { status: 401 });
  }

  const rawBody = await request.json();
  const parsed = telegramUpdateSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ ok: true });
  }

  const callback = parsed.data.callback_query;
  if (callback && isFromAdmin(callback.from.id)) {
    const [action, busquedaId] = callback.data.split(":");
    if (action === "aprobar_busqueda" && busquedaId) {
      const { busquedas, contactos } = getDomainModules();
      const busqueda = await busquedas.findById(busquedaId);
      if (busqueda) {
        const contacto = await contactos.findById(busqueda.contacto_id);
        await busquedas.update(busquedaId, { documento_aprobado: true });
        if (contacto?.whatsapp_confirmado) {
          await enviarDocumentoAprobado(busquedaId);
          await sendMessage(callback.message.chat.id, "Listo, se lo mandé por WhatsApp.");
        } else {
          await sendMessage(
            callback.message.chat.id,
            "Aprobado. Todavía no confirmó por WhatsApp — se lo mando apenas escriba."
          );
        }
      }
    }
    return NextResponse.json({ ok: true });
  }

  const chatId = parsed.data.message?.chat.id;
  const document = parsed.data.message?.document;

  if (document && chatId && isFromAdmin(chatId)) {
    const parsedCaption = parseImportCaption(parsed.data.message?.caption ?? "");
    if (!parsedCaption) {
      await sendMessage(
        chatId,
        "Para importar una conversación, mandá el .txt con este formato en el texto del mensaje: Nombre, Teléfono (ej: Juan Pérez, 3511234567)."
      );
      return NextResponse.json({ ok: true });
    }

    try {
      const fileUrl = await getFileDownloadUrl(document.file_id);
      const fileBuffer = await downloadFile(fileUrl);
      const texto = fileBuffer.toString("utf-8");

      const pool = getPool();
      const { respuesta } = await importarConversacionWhatsApp(
        {
          extractConversacionImportada,
          contactos: createContactosModule(pool),
          conversaciones: createConversacionesModule(pool),
        },
        texto,
        parsedCaption.nombre,
        parsedCaption.telefono
      );

      await sendMessage(chatId, respuesta);
    } catch (error) {
      console.error("Failed to import WhatsApp conversation", error);
      await sendMessage(chatId, "No pude procesar ese archivo. Probá de nuevo en un rato.");
    }

    return NextResponse.json({ ok: true });
  }

  const voice = parsed.data.message?.voice;

  // This bot is for the agent's own internal note-taking, not a public assistant — silently
  // drop anything from a chat that isn't hers, rather than processing (and paying Groq for)
  // voice notes from whoever finds the bot's username.
  if (!voice || !chatId || !isFromAdmin(chatId)) {
    return NextResponse.json({ ok: true });
  }

  try {
    const fileUrl = await getFileDownloadUrl(voice.file_id);
    const audioBuffer = await downloadFile(fileUrl);

    const pool = getPool();
    const { respuesta } = await processVoiceNote(
      {
        transcribeAudio,
        extractStructuredData,
        contactos: createContactosModule(pool),
        propiedades: createPropiedadesModule(pool),
        conversaciones: createConversacionesModule(pool),
        muestras: createMuestrasModule(pool),
        consultas: createConsultasModule(pool),
        ofertas: createOfertasModule(pool),
      },
      audioBuffer,
      // Groq's transcription endpoint validates by filename extension and does not accept
      // ".oga" (Telegram's own naming for voice notes) even though the underlying audio is
      // plain Ogg/Opus, which Groq does accept under the ".ogg" extension.
      `${voice.file_id}.ogg`
    );

    await sendMessage(chatId, respuesta);
  } catch (error) {
    console.error("Failed to process voice note", error);
    await sendMessage(chatId, "No pude procesar esa nota de voz. Probá de nuevo en un rato.");
  }

  return NextResponse.json({ ok: true });
}
