import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { createHmac } from "node:crypto";

vi.mock("@/lib/meta/client", () => ({
  sendMessengerMessage: vi.fn().mockResolvedValue(undefined),
  sendInstagramMessage: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/db/pool", () => ({ getPool: vi.fn().mockReturnValue({}) }));

// The route generates its own token via randomUUID() and only ever reads that local value —
// it never reads a token back from leadsPendientes.create()'s return value. Mock randomUUID
// itself so the test can assert on a predictable link instead of the create() mock's (unused)
// return shape. Preserve the rest of the real module (via importOriginal) because this test
// file also needs the real createHmac to build signed request bodies below.
vi.mock("node:crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:crypto")>();
  return { ...actual, randomUUID: () => "tok-generated" };
});

const leadsPendientesCreate = vi.fn().mockResolvedValue({ id: "lead-1" });
vi.mock("@/lib/domain/factory", () => ({
  getDomainModules: () => ({
    leadsPendientes: { create: leadsPendientesCreate },
  }),
}));

import { GET, POST } from "./route";
import { sendMessengerMessage, sendInstagramMessage } from "@/lib/meta/client";

function signedRequest(body: unknown) {
  const rawBody = JSON.stringify(body);
  const signature =
    "sha256=" + createHmac("sha256", "test-secret").update(rawBody).digest("hex");
  return new NextRequest("https://example.com/api/meta/webhook", {
    method: "POST",
    headers: { "x-hub-signature-256": signature, "content-type": "application/json" },
    body: rawBody,
  });
}

describe("GET /api/meta/webhook (verification)", () => {
  beforeEach(() => {
    process.env.META_VERIFY_TOKEN = "verify-me";
  });

  it("returns the challenge when the verify token matches", async () => {
    const url =
      "https://example.com/api/meta/webhook?hub.mode=subscribe&hub.verify_token=verify-me&hub.challenge=abc123";
    const response = await GET(new NextRequest(url));
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("abc123");
  });

  it("rejects when the verify token does not match", async () => {
    const url =
      "https://example.com/api/meta/webhook?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=abc123";
    const response = await GET(new NextRequest(url));
    expect(response.status).toBe(403);
  });
});

describe("POST /api/meta/webhook (messages)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    leadsPendientesCreate.mockResolvedValue({ id: "lead-1" });
    process.env.META_APP_SECRET = "test-secret";
    process.env.APP_BASE_URL = "https://brunella-realstate.vercel.app";
  });

  it("rejects requests with an invalid signature", async () => {
    const request = new NextRequest("https://example.com/api/meta/webhook", {
      method: "POST",
      headers: { "x-hub-signature-256": "sha256=invalid" },
      body: JSON.stringify({ object: "page", entry: [] }),
    });
    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it("replies on Messenger with a form link and stores the referral", async () => {
    const request = signedRequest({
      object: "page",
      entry: [
        {
          messaging: [
            {
              sender: { id: "psid-1" },
              message: { text: "hola" },
              referral: { ref: "COD-TEST" },
            },
          ],
        },
      ],
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(leadsPendientesCreate).toHaveBeenCalledWith(
      expect.objectContaining({ canal: "Facebook", psid: "psid-1", codigo_propiedad: "COD-TEST" })
    );
    expect(sendMessengerMessage).toHaveBeenCalledWith(
      "psid-1",
      expect.stringContaining("tok-generated")
    );
  });

  it("replies on Instagram without a referral when there is none", async () => {
    const request = signedRequest({
      object: "instagram",
      entry: [
        {
          messaging: [{ sender: { id: "igsid-1" }, message: { text: "hola" } }],
        },
      ],
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(leadsPendientesCreate).toHaveBeenCalledWith(
      expect.objectContaining({ canal: "Instagram", psid: "igsid-1", codigo_propiedad: null })
    );
    expect(sendInstagramMessage).toHaveBeenCalled();
  });

  it("ignores malformed payloads instead of throwing", async () => {
    const request = signedRequest({ not: "a meta event" });
    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(sendMessengerMessage).not.toHaveBeenCalled();
    expect(sendInstagramMessage).not.toHaveBeenCalled();
  });
});
