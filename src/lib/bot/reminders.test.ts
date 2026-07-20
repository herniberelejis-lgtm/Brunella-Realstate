import { describe, it, expect } from "vitest";
import { buildRecordatorioMessage } from "./reminders";
import type { Contacto } from "../domain/contactos";

function contacto(nombre: string): Contacto {
  return {
    id: "1",
    nombre,
    telefono: null,
    email: null,
    fuente: "Otro",
    fecha_primer_contacto: "2026-01-01",
    tipo: "Comprador",
    etapa: "Buscando",
    temperatura: "Tibio",
    ultima_actividad: "2026-01-01",
    whatsapp_confirmado: false,
    created_at: "2026-01-01",
  };
}

describe("buildRecordatorioMessage", () => {
  it("returns a friendly no-pending message when the list is empty", () => {
    expect(buildRecordatorioMessage([])).toMatch(/nadie|al día/i);
  });

  it("lists each contact needing follow-up", () => {
    const message = buildRecordatorioMessage([contacto("María Gómez"), contacto("Juan Pérez")]);
    expect(message).toContain("María Gómez");
    expect(message).toContain("Juan Pérez");
  });
});
