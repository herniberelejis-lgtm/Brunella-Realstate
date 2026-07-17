import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { createHmac } from "node:crypto";

const marcarWhatsappConfirmado = vi.fn().mockResolvedValue(undefined);
const findByTelefono = vi.fn().mockResolvedValue({ id: "contacto-1", telefono: "5493511234567" });
const findPendienteAprobadoByContactoId = vi.fn().mockResolvedValue(null);

vi.mock("@/lib/domain/factory", () => ({
  getDomainModules: () => ({
    contactos: { findByTelefono, marcarWhatsappConfirmado },
    busquedas: { findPendienteAprobadoByContactoId },
  }),
}));
// Defined inline (not as an outer const referenced by the factory) — referencing a
// same-named top-level const from inside vi.mock's factory intermittently throws
// "Cannot access '...' before initialization" for this specific module in this codebase's
// vitest setup, even though the equivalent pattern works for other mocked modules elsewhere
// (see src/app/api/meta/webhook/route.test.ts's leadsPendientesCreate). Import the mocked
// function back out to assert on it, matching that same file's sendMessengerMessage pattern.
vi.mock("@/lib/bot/enviarDocumentoAprobado", () => ({
  enviarDocumentoAprobado: vi.fn().mockResolvedValue(undefined),
}));

import { GET, POST } from "./route";
import { enviarDocumentoAprobado } from "@/lib/bot/enviarDocumentoAprobado";

function signedRequest(body: unknown) {
  const rawBody = JSON.stringify(body);
  const signature = "sha256=" + createHmac("sha256", "test-secret").update(rawBody).digest("hex");
  return new NextRequest("https://example.com/api/whatsapp/webhook", {
    method: "POST",
    headers: { "x-hub-signature-256": signature },
    body: rawBody,
  });
}

describe("GET /api/whatsapp/webhook", () => {
  it("returns the challenge when the verify token matches", async () => {
    process.env.META_VERIFY_TOKEN = "verify-me";
    const url =
      "https://example.com/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=verify-me&hub.challenge=xyz";
    const response = await GET(new NextRequest(url));
    expect(await response.text()).toBe("xyz");
  });
});

describe("POST /api/whatsapp/webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findByTelefono.mockResolvedValue({ id: "contacto-1", telefono: "5493511234567" });
    findPendienteAprobadoByContactoId.mockResolvedValue(null);
    process.env.META_APP_SECRET = "test-secret";
  });

  it("marks the contacto as confirmed when a message arrives from their number", async () => {
    const request = signedRequest({
      entry: [
        {
          changes: [
            {
              value: {
                messages: [{ from: "5493511234567", text: { body: "Hola" } }],
              },
            },
          ],
        },
      ],
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(marcarWhatsappConfirmado).toHaveBeenCalledWith("contacto-1");
  });

  it("sends the pending approved document once the client confirms", async () => {
    findPendienteAprobadoByContactoId.mockResolvedValue({ id: "busqueda-1" });
    const request = signedRequest({
      entry: [
        { changes: [{ value: { messages: [{ from: "5493511234567", text: { body: "Hola" } }] } }] },
      ],
    });

    await POST(request);

    expect(enviarDocumentoAprobado).toHaveBeenCalledWith("busqueda-1");
  });

  it("ignores messages from unknown numbers instead of throwing", async () => {
    findByTelefono.mockResolvedValue(null);
    const request = signedRequest({
      entry: [{ changes: [{ value: { messages: [{ from: "0000000000", text: {} }] } }] }],
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(marcarWhatsappConfirmado).not.toHaveBeenCalled();
  });

  it("rejects requests with an invalid signature", async () => {
    const request = new NextRequest("https://example.com/api/whatsapp/webhook", {
      method: "POST",
      headers: { "x-hub-signature-256": "sha256=invalid" },
      body: JSON.stringify({ entry: [] }),
    });

    const response = await POST(request);

    expect(response.status).toBe(401);
    expect(marcarWhatsappConfirmado).not.toHaveBeenCalled();
  });

  it("ignores a validly-signed but malformed JSON body instead of throwing", async () => {
    const rawBody = "not json";
    const signature = "sha256=" + createHmac("sha256", "test-secret").update(rawBody).digest("hex");
    const request = new NextRequest("https://example.com/api/whatsapp/webhook", {
      method: "POST",
      headers: { "x-hub-signature-256": signature },
      body: rawBody,
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(marcarWhatsappConfirmado).not.toHaveBeenCalled();
  });
});
