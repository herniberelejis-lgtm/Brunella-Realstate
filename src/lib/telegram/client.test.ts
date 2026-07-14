import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  sendMessage,
  getFileDownloadUrl,
  downloadFile,
  verifyWebhookSecret,
} from "./client";

describe("telegram client", () => {
  beforeEach(() => {
    process.env.TELEGRAM_BOT_TOKEN = "test-token";
    process.env.TELEGRAM_WEBHOOK_SECRET = "shh";
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends a message via the Bot API", async () => {
    (fetch as any).mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });

    await sendMessage(12345, "Hola");

    const [url, options] = (fetch as any).mock.calls[0];
    expect(url).toBe("https://api.telegram.org/bottest-token/sendMessage");
    const body = JSON.parse(options.body);
    expect(body).toEqual({ chat_id: 12345, text: "Hola" });
  });

  it("resolves a file_id to a downloadable URL", async () => {
    (fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, result: { file_path: "voice/file123.oga" } }),
    });

    const url = await getFileDownloadUrl("file123");

    expect(url).toBe(
      "https://api.telegram.org/file/bottest-token/voice/file123.oga"
    );
  });

  it("downloads file bytes from a URL", async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    (fetch as any).mockResolvedValue({
      ok: true,
      arrayBuffer: async () => bytes.buffer,
    });

    const buffer = await downloadFile("https://example.com/file.oga");

    expect(Buffer.from(buffer)).toEqual(Buffer.from(bytes));
  });

  it("verifies the webhook secret header matches the configured secret", () => {
    expect(verifyWebhookSecret("shh")).toBe(true);
    expect(verifyWebhookSecret("wrong")).toBe(false);
    expect(verifyWebhookSecret(undefined)).toBe(false);
  });
});
