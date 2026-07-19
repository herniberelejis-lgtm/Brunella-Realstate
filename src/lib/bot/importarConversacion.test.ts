import { describe, it, expect, vi } from "vitest";
import { importarConversacionWhatsApp, type ImportarConversacionDeps } from "./importarConversacion";

function buildDeps(overrides: Partial<ImportarConversacionDeps> = {}): ImportarConversacionDeps {
  const defaults: ImportarConversacionDeps = {
    extractConversacionImportada: vi.fn().mockResolvedValue({
      resumen: "El cliente buscaba un departamento en Nueva Córdoba.",
      tipoCliente: "Comprador",
      zonaMencionada: "Nueva Córdoba",
      tipoPropiedadMencionada: "Departamento",
      presupuestoMin: null,
      presupuestoMax: null,
      moneda: null,
      confianza: "alta",
    }),
    contactos: {
      findByTelefono: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: "contacto-1", nombre: "Juan" }),
      marcarActividad: vi.fn().mockResolvedValue(undefined),
    } as any,
    conversaciones: { create: vi.fn().mockResolvedValue({ id: "conv-1" }) } as any,
  };
  return {
    ...defaults,
    ...overrides,
    contactos: { ...defaults.contactos, ...(overrides.contactos as object) } as any,
  };
}

describe("importarConversacionWhatsApp", () => {
  it("creates a new contacto and a conversación when the phone is unknown", async () => {
    const deps = buildDeps();

    const result = await importarConversacionWhatsApp(deps, "texto exportado", "Juan Pérez", "3511234567");

    expect(deps.contactos.create).toHaveBeenCalledWith(
      expect.objectContaining({ nombre: "Juan Pérez", telefono: "3511234567", tipo: "Comprador" })
    );
    expect(deps.conversaciones.create).toHaveBeenCalledWith(
      expect.objectContaining({
        contacto_id: "contacto-1",
        canal: "WhatsApp",
        origen: "importado_whatsapp",
        resumen: expect.stringContaining("Nueva Córdoba"),
      })
    );
    expect(result.respuesta).toContain("Juan");
  });

  it("reuses an existing contacto instead of creating a duplicate", async () => {
    const deps = buildDeps({
      contactos: {
        findByTelefono: vi.fn().mockResolvedValue({ id: "contacto-existing", nombre: "Juan" }),
      } as any,
    });

    await importarConversacionWhatsApp(deps, "texto exportado", "Juan Pérez", "3511234567");

    expect(deps.contactos.create).not.toHaveBeenCalled();
    expect(deps.conversaciones.create).toHaveBeenCalledWith(
      expect.objectContaining({ contacto_id: "contacto-existing" })
    );
  });

  it("does not create anything when confianza is 'baja'", async () => {
    const deps = buildDeps({
      extractConversacionImportada: vi.fn().mockResolvedValue({
        resumen: "No pude resumir esta conversación automáticamente.",
        tipoCliente: null,
        zonaMencionada: null,
        tipoPropiedadMencionada: null,
        presupuestoMin: null,
        presupuestoMax: null,
        moneda: null,
        confianza: "baja",
      }),
    });

    const result = await importarConversacionWhatsApp(deps, "garbage", "Juan Pérez", "3511234567");

    expect(deps.contactos.create).not.toHaveBeenCalled();
    expect(deps.conversaciones.create).not.toHaveBeenCalled();
    expect(result.respuesta).toMatch(/no pude/i);
  });
});
