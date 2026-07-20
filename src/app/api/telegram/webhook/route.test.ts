import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/telegram/client", () => ({
  verifyWebhookSecret: vi.fn(),
  getFileDownloadUrl: vi.fn().mockResolvedValue("https://example.com/file.oga"),
  downloadFile: vi.fn().mockResolvedValue(Buffer.from("audio")),
  sendMessage: vi.fn().mockResolvedValue(undefined),
  answerCallbackQuery: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/bot/processVoiceNote", () => ({
  processVoiceNote: vi.fn().mockResolvedValue({ respuesta: "✅ Guardé todo" }),
}));
vi.mock("@/lib/bot/importarConversacion", () => ({
  importarConversacionWhatsApp: vi.fn().mockResolvedValue({ respuesta: "✅ Importé la conversación" }),
}));
vi.mock("@/lib/db/pool", () => ({ getPool: vi.fn().mockReturnValue({}) }));

import { POST } from "./route";
import { verifyWebhookSecret, sendMessage } from "@/lib/telegram/client";
import { processVoiceNote } from "@/lib/bot/processVoiceNote";
import { importarConversacionWhatsApp } from "@/lib/bot/importarConversacion";

function buildRequest(body: unknown, secretHeader?: string) {
  return new NextRequest("https://example.com/api/telegram/webhook", {
    method: "POST",
    headers: secretHeader ? { "x-telegram-bot-api-secret-token": secretHeader } : {},
    body: JSON.stringify(body),
  });
}

describe("POST /api/telegram/webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(verifyWebhookSecret).mockReturnValue(true);
    process.env.TELEGRAM_ADMIN_CHAT_ID = "1";
  });

  it("rejects requests with an invalid webhook secret", async () => {
    vi.mocked(verifyWebhookSecret).mockReturnValue(false);

    const response = await POST(buildRequest({}, "wrong-secret"));

    expect(response.status).toBe(401);
  });

  it("ignores updates without a voice message", async () => {
    const response = await POST(
      buildRequest({ message: { chat: { id: 1 }, text: "hola" } }, "secret")
    );

    expect(response.status).toBe(200);
    expect(processVoiceNote).not.toHaveBeenCalled();
  });

  it("processes a voice note and replies with the confirmation", async () => {
    const response = await POST(
      buildRequest(
        { message: { chat: { id: 1 }, voice: { file_id: "abc123" } } },
        "secret"
      )
    );

    expect(response.status).toBe(200);
    expect(processVoiceNote).toHaveBeenCalled();
  });

  it("silently ignores voice notes from a chat id other than the configured admin", async () => {
    const response = await POST(
      buildRequest(
        { message: { chat: { id: 42 }, voice: { file_id: "abc123" } } },
        "secret"
      )
    );

    expect(response.status).toBe(200);
    expect(processVoiceNote).not.toHaveBeenCalled();
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("ignores every update when TELEGRAM_ADMIN_CHAT_ID is not configured", async () => {
    delete process.env.TELEGRAM_ADMIN_CHAT_ID;
    const response = await POST(
      buildRequest(
        { message: { chat: { id: 1 }, voice: { file_id: "abc123" } } },
        "secret"
      )
    );

    expect(response.status).toBe(200);
    expect(processVoiceNote).not.toHaveBeenCalled();
  });

  it("replies with an error message instead of throwing when processing fails", async () => {
    vi.mocked(processVoiceNote).mockRejectedValueOnce(new Error("Groq is down"));

    const response = await POST(
      buildRequest(
        { message: { chat: { id: 1 }, voice: { file_id: "abc123" } } },
        "secret"
      )
    );

    expect(response.status).toBe(200);
    expect(sendMessage).toHaveBeenCalledWith(1, expect.stringMatching(/no pude procesar/i));
  });

  it("imports a WhatsApp conversation document with a valid 'Nombre, Teléfono' caption", async () => {
    const response = await POST(
      buildRequest(
        {
          message: {
            chat: { id: 1 },
            document: { file_id: "doc123" },
            caption: "Juan Pérez, 3511234567",
          },
        },
        "secret"
      )
    );

    expect(response.status).toBe(200);
    expect(importarConversacionWhatsApp).toHaveBeenCalledWith(
      expect.anything(),
      "audio", // downloadFile mock returns Buffer.from("audio") regardless of file type
      "Juan Pérez",
      "3511234567"
    );
    expect(sendMessage).toHaveBeenCalledWith(1, expect.stringContaining("Importé"));
  });

  it("asks for the correct caption format instead of importing when the caption is missing or malformed", async () => {
    const response = await POST(
      buildRequest(
        { message: { chat: { id: 1 }, document: { file_id: "doc123" }, caption: "sin formato" } },
        "secret"
      )
    );

    expect(response.status).toBe(200);
    expect(importarConversacionWhatsApp).not.toHaveBeenCalled();
    expect(sendMessage).toHaveBeenCalledWith(1, expect.stringMatching(/nombre, tel[ée]fono/i));
  });

  it("silently ignores documents from a chat id other than the configured admin", async () => {
    const response = await POST(
      buildRequest(
        {
          message: {
            chat: { id: 42 },
            document: { file_id: "doc123" },
            caption: "Juan Pérez, 3511234567",
          },
        },
        "secret"
      )
    );

    expect(response.status).toBe(200);
    expect(importarConversacionWhatsApp).not.toHaveBeenCalled();
  });

  it("ignores malformed update bodies instead of throwing", async () => {
    const response = await POST(buildRequest({ not: "a telegram update" }, "secret"));
    expect(response.status).toBe(200);
    expect(processVoiceNote).not.toHaveBeenCalled();
  });

  it("approves and sends immediately when the contacto already confirmed WhatsApp", async () => {
    const busquedasFindById = vi.fn().mockResolvedValue({ id: "b1", contacto_id: "c1" });
    const busquedasUpdate = vi.fn().mockResolvedValue({});
    const contactosFindById = vi.fn().mockResolvedValue({ id: "c1", whatsapp_confirmado: true });
    vi.doMock("@/lib/domain/factory", () => ({
      getDomainModules: () => ({
        busquedas: { findById: busquedasFindById, update: busquedasUpdate },
        contactos: { findById: contactosFindById },
      }),
    }));
    const { enviarDocumentoAprobado } = await import("@/lib/bot/enviarDocumentoAprobado");
    vi.mocked(enviarDocumentoAprobado);

    const response = await POST(
      buildRequest(
        {
          callback_query: {
            id: "cb1",
            data: "aprobar_busqueda:b1",
            from: { id: 1 },
            message: { chat: { id: 1 } },
          },
        },
        "secret"
      )
    );

    expect(response.status).toBe(200);
  });
});
