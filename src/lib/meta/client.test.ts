import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { sendMessengerMessage, sendInstagramMessage } from "./client";

describe("Meta messaging client", () => {
  beforeEach(() => {
    process.env.MESSENGER_PAGE_ACCESS_TOKEN = "page-token";
    process.env.INSTAGRAM_ACCESS_TOKEN = "ig-token";
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }) as any;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends a Messenger message with the page access token", async () => {
    await sendMessengerMessage("psid-1", "hola");
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("access_token=page-token"),
      expect.objectContaining({ method: "POST" })
    );
  });

  it("sends an Instagram message with the Instagram access token", async () => {
    await sendInstagramMessage("igsid-1", "hola");
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("access_token=ig-token"),
      expect.objectContaining({ method: "POST" })
    );
  });

  it("throws when the Graph API call fails", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 400 }) as any;
    await expect(sendMessengerMessage("psid-1", "hola")).rejects.toThrow();
  });
});
