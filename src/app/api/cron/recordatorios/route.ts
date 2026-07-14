import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db/pool";
import { createContactosModule } from "@/lib/domain/contactos";
import { sendMessage } from "@/lib/telegram/client";
import { buildRecordatorioMessage } from "@/lib/bot/reminders";
import { safeEqual } from "@/lib/security/safeEqual";

const DIAS_SIN_ACTIVIDAD = 5;

function isAuthorized(request: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return false;
  return safeEqual(authHeader, `Bearer ${expected}`);
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const adminChatIdRaw = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (!adminChatIdRaw) {
    console.error("TELEGRAM_ADMIN_CHAT_ID is not set — cannot send the reminder");
    return NextResponse.json({ error: "server misconfigured" }, { status: 500 });
  }

  try {
    const pool = getPool();
    const contactos = createContactosModule(pool);
    const pendientes = await contactos.findNecesitanSeguimiento(DIAS_SIN_ACTIVIDAD);

    await sendMessage(Number(adminChatIdRaw), buildRecordatorioMessage(pendientes));

    return NextResponse.json({ ok: true, cantidad: pendientes.length });
  } catch (error) {
    console.error("Failed to send daily reminder", error);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
