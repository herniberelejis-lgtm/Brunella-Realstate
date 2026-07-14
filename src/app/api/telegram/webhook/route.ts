import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import {
  verifyWebhookSecret,
  getFileDownloadUrl,
  downloadFile,
  sendMessage,
} from "@/lib/telegram/client";
import { processVoiceNote } from "@/lib/bot/processVoiceNote";
import { transcribeAudio, extractStructuredData } from "@/lib/groq/client";
import { getPool } from "@/lib/db/pool";
import { createContactosModule } from "@/lib/domain/contactos";
import { createPropiedadesModule } from "@/lib/domain/propiedades";
import { createConversacionesModule } from "@/lib/domain/conversaciones";
import { createMuestrasModule } from "@/lib/domain/muestras";
import { createConsultasModule } from "@/lib/domain/consultas";
import { createOfertasModule } from "@/lib/domain/ofertas";

// Default serverless function timeout (10s on Vercel Hobby) is too short for
// download + transcribe + LLM extraction + DB writes in sequence.
export const maxDuration = 60;

const telegramUpdateSchema = z.object({
  message: z
    .object({
      chat: z.object({ id: z.number() }),
      text: z.string().optional(),
      voice: z.object({ file_id: z.string() }).optional(),
    })
    .optional(),
});

function isFromAdmin(chatId: number): boolean {
  const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (!adminChatId) return false;
  return chatId === Number(adminChatId);
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

  const voice = parsed.data.message?.voice;
  const chatId = parsed.data.message?.chat.id;

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
