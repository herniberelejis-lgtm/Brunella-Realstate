import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { sendWhatsAppText, sendWhatsAppImage, sendWhatsAppTemplate } from "./client";

describe("WhatsApp Cloud API client", () => {
  beforeEach(() => {
    process.env.WHATSAPP_ACCESS_TOKEN = "wa-token";
    process.env.WHATSAPP_PHONE_NUMBER_ID = "1234567890";
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }) as any;
  });

  afterEach(() => vi.restoreAllMocks());

  it("sends a text message to the given phone number", async () => {
    await sendWhatsAppText("5493511234567", "hola");
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("1234567890/messages"),
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer wa-token" }),
      })
    );
  });

  it("sends an image message with a caption", async () => {
    await sendWhatsAppImage("5493511234567", "https://example.com/foto.jpg", "Depto en Nueva Córdoba");
    const call = (fetch as any).mock.calls[0];
    const body = JSON.parse(call[1].body);
    expect(body.type).toBe("image");
    expect(body.image.link).toBe("https://example.com/foto.jpg");
    expect(body.image.caption).toBe("Depto en Nueva Córdoba");
  });

  it("sends a template message with body parameters", async () => {
    await sendWhatsAppTemplate("5493511234567", "seguimiento_migracion", "es_AR", ["Juan"]);
    const call = (fetch as any).mock.calls[0];
    const body = JSON.parse(call[1].body);
    expect(body.type).toBe("template");
    expect(body.template.name).toBe("seguimiento_migracion");
    expect(body.template.language.code).toBe("es_AR");
    expect(body.template.components[0].parameters[0].text).toBe("Juan");
  });

  it("omits components when the template has no body parameters", async () => {
    await sendWhatsAppTemplate("5493511234567", "hola_simple", "es_AR", []);
    const call = (fetch as any).mock.calls[0];
    const body = JSON.parse(call[1].body);
    expect(body.template.components).toBeUndefined();
  });

  it("throws when the Graph API call fails", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 401 }) as any;
    await expect(sendWhatsAppText("5493511234567", "hola")).rejects.toThrow();
  });
});
