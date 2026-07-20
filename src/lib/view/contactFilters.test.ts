import { describe, it, expect } from "vitest";
import { filterContactos, needsFollowUp, filterContactoIdsByZona } from "./contactFilters";
import type { Contacto } from "../domain/contactos";
import type { Busqueda } from "../domain/busquedas";

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
    whatsapp_confirmado: false,
    created_at: "2026-01-01",
    ...overrides,
  };
}

function busqueda(overrides: Partial<Busqueda>): Busqueda {
  return {
    id: "b1",
    contacto_id: "1",
    tipo_operacion: "Compra",
    presupuesto_min: null,
    presupuesto_max: null,
    moneda: null,
    zona: null,
    tipo_propiedad: null,
    dormitorios: null,
    ambientes: null,
    banos: null,
    caracteristicas: [],
    otros_requisitos: null,
    activa: true,
    documento_aprobado: false,
    documento_enviado: false,
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

describe("filterContactoIdsByZona", () => {
  it("returns contacto_ids whose búsqueda zona matches, accent-insensitive", () => {
    const busquedas = [
      busqueda({ contacto_id: "1", zona: "Nueva Córdoba" }),
      busqueda({ contacto_id: "2", zona: "Cerro de las Rosas" }),
    ];
    expect(filterContactoIdsByZona(busquedas, "cordoba")).toEqual(new Set(["1"]));
  });

  it("returns null (no filter) when zona is empty", () => {
    const busquedas = [busqueda({ contacto_id: "1", zona: "Nueva Córdoba" })];
    expect(filterContactoIdsByZona(busquedas, "")).toBeNull();
  });
});
