import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/db/pool", () => ({ getPool: vi.fn().mockReturnValue({}) }));
vi.mock("@/lib/domain/contactos", () => ({
  createContactosModule: vi.fn().mockReturnValue({
    findNecesitanSeguimiento: vi.fn().mockResolvedValue([]),
  }),
}));
vi.mock("@/lib/telegram/client", () => ({ sendMessage: vi.fn().mockResolvedValue(undefined) }));

import { GET } from "./route";
import { sendMessage } from "@/lib/telegram/client";

function buildRequest(authHeader?: string) {
  return new NextRequest("https://example.com/api/cron/recordatorios", {
    headers: authHeader ? { authorization: authHeader } : {},
  });
}

describe("GET /api/cron/recordatorios", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "cronsecret";
    process.env.TELEGRAM_ADMIN_CHAT_ID = "999";
  });

  it("rejects requests without the correct bearer secret", async () => {
    const response = await GET(buildRequest("Bearer wrong"));
    expect(response.status).toBe(401);
  });

  it("rejects requests when CRON_SECRET is not configured, even with a literal 'undefined' bearer", async () => {
    delete process.env.CRON_SECRET;
    const response = await GET(buildRequest("Bearer undefined"));
    expect(response.status).toBe(401);
  });

  it("sends the reminder message to the admin chat when authorized", async () => {
    const response = await GET(buildRequest("Bearer cronsecret"));
    expect(response.status).toBe(200);
    expect(sendMessage).toHaveBeenCalledWith(999, expect.any(String));
  });

  it("returns 500 without sending anything when TELEGRAM_ADMIN_CHAT_ID is not set", async () => {
    delete process.env.TELEGRAM_ADMIN_CHAT_ID;
    const response = await GET(buildRequest("Bearer cronsecret"));
    expect(response.status).toBe(500);
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("returns 500 instead of throwing when sendMessage fails", async () => {
    vi.mocked(sendMessage).mockRejectedValueOnce(new Error("Telegram is down"));
    const response = await GET(buildRequest("Bearer cronsecret"));
    expect(response.status).toBe(500);
  });
});
