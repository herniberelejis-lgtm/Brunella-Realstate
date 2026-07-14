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

type TelegramUpdate = {
  message?: {
    chat: { id: number };
    text?: string;
    voice?: { file_id: string };
  };
};

export async function POST(request: NextRequest) {
  const secretHeader = request.headers.get("x-telegram-bot-api-secret-token");
  if (!verifyWebhookSecret(secretHeader)) {
    return NextResponse.json({ error: "invalid secret" }, { status: 401 });
  }

  const update = (await request.json()) as TelegramUpdate;
  const voice = update.message?.voice;
  const chatId = update.message?.chat.id;

  if (!voice || !chatId) {
    return NextResponse.json({ ok: true });
  }

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
    `${voice.file_id}.oga`
  );

  await sendMessage(chatId, respuesta);

  return NextResponse.json({ ok: true });
}
