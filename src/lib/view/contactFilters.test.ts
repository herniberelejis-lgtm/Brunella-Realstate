import { describe, it, expect } from "vitest";
import { filterContactos, needsFollowUp } from "./contactFilters";
import type { Contacto } from "../domain/contactos";

function contacto(overrides: Partial<Contacto>): Contacto {
  return {
    id: "1",
    nombre: "Test",
    telefono: null,
    email: null,
    fuente: "Otro",
    fecha_primer_contacto: "2026-01-01",
    tipo: "Comprador",
    etapa: "Nuevo",
    temperatura: "Tibio",
    ultima_actividad: new Date().toISOString(),
    created_at: "2026-01-01",
    ...overrides,
  };
}

describe("filterContactos", () => {
  it("filters by tipo", () => {
    const contactos = [contacto({ tipo: "Comprador" }), contacto({ tipo: "Propietario" })];
    expect(filterContactos(contactos, { tipo: "Propietario" })).toHaveLength(1);
  });

  it("returns all contacts when no filters are given", () => {
    const contactos = [contacto({}), contacto({})];
    expect(filterContactos(contactos, {})).toHaveLength(2);
  });
});

describe("needsFollowUp", () => {
  it("is true for a stale, non-closed contact", () => {
    const staleDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    expect(
      needsFollowUp(contacto({ etapa: "Buscando", ultima_actividad: staleDate }), 5)
    ).toBe(true);
  });

  it("is false for a closed contact even if stale", () => {
    const staleDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    expect(
      needsFollowUp(contacto({ etapa: "Cerrado-ganado", ultima_actividad: staleDate }), 5)
    ).toBe(false);
  });

  it("is false for a fresh contact", () => {
    expect(needsFollowUp(contacto({ etapa: "Buscando" }), 5)).toBe(false);
  });
});
