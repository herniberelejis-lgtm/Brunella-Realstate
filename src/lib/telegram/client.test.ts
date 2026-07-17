import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  sendMessage,
  getFileDownloadUrl,
  downloadFile,
  verifyWebhookSecret,
  sendMediaGroup,
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

  it("throws when sendMessage fails", async () => {
    (fetch as any).mockResolvedValue({ ok: false, status: 500 });
    await expect(sendMessage(1, "hola")).rejects.toThrow(/Telegram sendMessage failed/);
  });

  it("throws when getFile fails", async () => {
    (fetch as any).mockResolvedValue({ ok: false, status: 404 });
    await expect(getFileDownloadUrl("bad-id")).rejects.toThrow(/Telegram getFile failed/);
  });

  it("throws when the file download fails", async () => {
    (fetch as any).mockResolvedValue({ ok: false, status: 403 });
    await expect(downloadFile("https://example.com/file.oga")).rejects.toThrow(
      /File download failed/
    );
  });

  it("sends a Telegram media group with the given photos", async () => {
    (fetch as any).mockResolvedValue({ ok: true, json: async () => ({}) });

    await sendMediaGroup(123, [
      { url: "https://example.com/a.jpg", caption: "Depto A" },
      { url: "https://example.com/b.jpg" },
    ]);

    const [url, options] = (fetch as any).mock.calls[0];
    expect(url).toBe("https://api.telegram.org/bottest-token/sendMediaGroup");
    const body = JSON.parse(options.body);
    expect(body.chat_id).toBe(123);
    expect(body.media).toHaveLength(2);
    expect(body.media[0]).toEqual({
      type: "photo",
      media: "https://example.com/a.jpg",
      caption: "Depto A",
    });
    expect(body.media[1]).toEqual({ type: "photo", media: "https://example.com/b.jpg" });
  });

  it("throws when sendMediaGroup fails", async () => {
    (fetch as any).mockResolvedValue({ ok: false, status: 400 });
    await expect(
      sendMediaGroup(123, [{ url: "https://example.com/a.jpg" }])
    ).rejects.toThrow(/Telegram sendMediaGroup failed/);
  });
});
