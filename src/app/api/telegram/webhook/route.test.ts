import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/telegram/client", () => ({
  verifyWebhookSecret: vi.fn(),
  getFileDownloadUrl: vi.fn().mockResolvedValue("https://example.com/file.oga"),
  downloadFile: vi.fn().mockResolvedValue(Buffer.from("audio")),
  sendMessage: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/bot/processVoiceNote", () => ({
  processVoiceNote: vi.fn().mockResolvedValue({ respuesta: "✅ Guardé todo" }),
}));
vi.mock("@/lib/db/pool", () => ({ getPool: vi.fn().mockReturnValue({}) }));

import { POST } from "./route";
import { verifyWebhookSecret } from "@/lib/telegram/client";
import { processVoiceNote } from "@/lib/bot/processVoiceNote";

function buildRequest(body: unknown, secretHeader?: string) {
  return new NextRequest("https://example.com/api/telegram/webhook", {
    method: "POST",
    headers: secretHeader ? { "x-telegram-bot-api-secret-token": secretHeader } : {},
    body: JSON.stringify(body),
  });
}

describe("POST /api/telegram/webhook", () => {
  beforeEach(() => {
    vi.mocked(verifyWebhookSecret).mockReturnValue(true);
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
});
