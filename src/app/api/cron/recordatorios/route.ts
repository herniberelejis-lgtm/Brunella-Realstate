import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db/pool";
import { createContactosModule } from "@/lib/domain/contactos";
import { sendMessage } from "@/lib/telegram/client";
import { buildRecordatorioMessage } from "@/lib/bot/reminders";

const DIAS_SIN_ACTIVIDAD = 5;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const pool = getPool();
  const contactos = createContactosModule(pool);
  const pendientes = await contactos.findNecesitanSeguimiento(DIAS_SIN_ACTIVIDAD);

  const adminChatId = Number(process.env.TELEGRAM_ADMIN_CHAT_ID);
  await sendMessage(adminChatId, buildRecordatorioMessage(pendientes));

  return NextResponse.json({ ok: true, cantidad: pendientes.length });
}
