import { describe, it, expect, vi } from "vitest";
import {
  enviarSeguimientoMasivo,
  buildSeguimientoResumen,
  type EnviarSeguimientoDeps,
  type SeguimientoConfig,
} from "./enviarSeguimientoMasivo";
import type { Contacto } from "../domain/contactos";

function contacto(overrides: Partial<Contacto>): Contacto {
  return {
    id: "c1",
    nombre: "Juan",
    telefono: "3511234567",
    email: null,
    fuente: "Otro",
    fecha_primer_contacto: "2026-01-01",
    tipo: "Comprador",
    etapa: "Nuevo",
    temperatura: "Tibio",
    ultima_actividad: "2026-01-01",
    whatsapp_confirmado: false,
    created_at: "2026-01-01",
    ...overrides,
  };
}

function buildDeps(
  contactos: Contacto[],
  overrides: Partial<EnviarSeguimientoDeps> = {}
): EnviarSeguimientoDeps {
  const byId = new Map(contactos.map((c) => [c.id, c]));
  return {
    conversaciones: {
      findContactoIdsByOrigen: vi.fn().mockResolvedValue(contactos.map((c) => c.id)),
    } as unknown as EnviarSeguimientoDeps["conversaciones"],
    contactos: {
      findById: vi.fn(async (id: string) => byId.get(id) ?? null),
    } as unknown as EnviarSeguimientoDeps["contactos"],
    sendWhatsAppTemplate: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

const configReal: SeguimientoConfig = {
  templateName: "seguimiento_migracion",
  languageCode: "es_AR",
  dryRun: false,
};

describe("enviarSeguimientoMasivo", () => {
  it("dry-run no envía nada y devuelve los destinatarios que califican", async () => {
    const deps = buildDeps([contacto({ id: "c1", nombre: "Juan" })]);
    const resultado = await enviarSeguimientoMasivo(deps, { ...configReal, dryRun: true });

    expect(deps.sendWhatsAppTemplate).not.toHaveBeenCalled();
    expect(resultado.dryRun).toBe(true);
    expect(resultado.destinatarios).toHaveLength(1);
    expect(resultado.enviados).toBe(0);
  });

  it("sin plantilla configurada, fuerza dry-run aunque se pida envío real", async () => {
    const deps = buildDeps([contacto({})]);
    const resultado = await enviarSeguimientoMasivo(deps, {
      templateName: null,
      languageCode: "es_AR",
      dryRun: false,
    });

    expect(deps.sendWhatsAppTemplate).not.toHaveBeenCalled();
    expect(resultado.dryRun).toBe(true);
  });

  it("omite a quien ya confirmó, no tiene teléfono, o está en etapa cerrada", async () => {
    const deps = buildDeps([
      contacto({ id: "ok", nombre: "Ok" }),
      contacto({ id: "conf", nombre: "Confirmado", whatsapp_confirmado: true }),
      contacto({ id: "sintel", nombre: "SinTel", telefono: null }),
      contacto({ id: "cerr", nombre: "Cerrado", etapa: "Cerrado-ganado" }),
    ]);
    const resultado = await enviarSeguimientoMasivo(deps, { ...configReal, dryRun: true });

    expect(resultado.destinatarios.map((d) => d.nombre)).toEqual(["Ok"]);
    expect(resultado.omitidos).toHaveLength(3);
  });

  it("envío real manda la plantilla a cada destinatario y cuenta los OK", async () => {
    const deps = buildDeps([
      contacto({ id: "c1", nombre: "Juan", telefono: "3511111111" }),
      contacto({ id: "c2", nombre: "Ana", telefono: "3512222222" }),
    ]);
    const resultado = await enviarSeguimientoMasivo(deps, configReal);

    expect(deps.sendWhatsAppTemplate).toHaveBeenCalledTimes(2);
    expect(deps.sendWhatsAppTemplate).toHaveBeenCalledWith(
      "3511111111",
      "seguimiento_migracion",
      "es_AR",
      ["Juan"]
    );
    expect(resultado.enviados).toBe(2);
    expect(resultado.fallidos).toHaveLength(0);
  });

  it("un fallo en un envío no frena el resto", async () => {
    const deps = buildDeps([
      contacto({ id: "c1", nombre: "Juan", telefono: "3511111111" }),
      contacto({ id: "c2", nombre: "Ana", telefono: "3512222222" }),
    ]);
    (deps.sendWhatsAppTemplate as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(new Error("429 rate limit"))
      .mockResolvedValueOnce(undefined);

    const resultado = await enviarSeguimientoMasivo(deps, configReal);

    expect(resultado.enviados).toBe(1);
    expect(resultado.fallidos).toEqual([{ nombre: "Juan", error: "429 rate limit" }]);
  });
});

describe("buildSeguimientoResumen", () => {
  it("marca la previsualización y explica cómo enviar de verdad", () => {
    const msg = buildSeguimientoResumen({
      destinatarios: [{ id: "c1", nombre: "Juan", telefono: "3511234567" }],
      omitidos: [],
      enviados: 0,
      fallidos: [],
      dryRun: true,
    });
    expect(msg).toMatch(/previsualizaci/i);
    expect(msg).toContain("Juan");
    expect(msg).toMatch(/WHATSAPP_TEMPLATE_SEGUIMIENTO/);
  });

  it("resume el envío real con enviados y fallidos", () => {
    const msg = buildSeguimientoResumen({
      destinatarios: [{ id: "c1", nombre: "Juan", telefono: "3511234567" }],
      omitidos: [{ nombre: "Ana", motivo: "ya confirmó por el número nuevo" }],
      enviados: 1,
      fallidos: [],
      dryRun: false,
    });
    expect(msg).toMatch(/Enviados OK: 1/);
    expect(msg).toMatch(/Omitidos: 1/);
  });
});
