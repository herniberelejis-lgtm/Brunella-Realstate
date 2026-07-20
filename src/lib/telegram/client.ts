import { safeEqual } from "../security/safeEqual";

function requireBotToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not set");
  return token;
}

function apiUrl(method: string): string {
  return `https://api.telegram.org/bot${requireBotToken()}/${method}`;
}

export async function sendMessage(
  chatId: number,
  text: string,
  options?: { reply_markup?: unknown }
): Promise<void> {
  const response = await fetch(apiUrl("sendMessage"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, ...options }),
  });
  if (!response.ok) {
    throw new Error(`Telegram sendMessage failed (${response.status})`);
  }
}

export async function getFileDownloadUrl(fileId: string): Promise<string> {
  const token = requireBotToken();
  const response = await fetch(
    `${apiUrl("getFile")}?file_id=${encodeURIComponent(fileId)}`
  );
  if (!response.ok) {
    throw new Error(`Telegram getFile failed (${response.status})`);
  }
  const data = await response.json();
  return `https://api.telegram.org/file/bot${token}/${data.result.file_path}`;
}

export async function downloadFile(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`File download failed (${response.status})`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function sendMediaGroup(
  chatId: number,
  photos: { url: string; caption?: string }[]
): Promise<void> {
  const response = await fetch(apiUrl("sendMediaGroup"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      media: photos.map((p) => ({
        type: "photo",
        media: p.url,
        ...(p.caption ? { caption: p.caption } : {}),
      })),
    }),
  });
  if (!response.ok) {
    throw new Error(`Telegram sendMediaGroup failed (${response.status})`);
  }
}

export async function answerCallbackQuery(callbackQueryId: string): Promise<void> {
  const response = await fetch(apiUrl("answerCallbackQuery"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: callbackQueryId }),
  });
  if (!response.ok) {
    throw new Error(`Telegram answerCallbackQuery failed (${response.status})`);
  }
}

export function verifyWebhookSecret(headerValue: string | undefined | null): boolean {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!expected || !headerValue) return false;
  return safeEqual(headerValue, expected);
}
