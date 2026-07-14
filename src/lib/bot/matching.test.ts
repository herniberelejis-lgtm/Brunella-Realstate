import { describe, it, expect } from "vitest";
import { matchContacto, matchPropiedad } from "./matching";
import type { Contacto } from "../domain/contactos";
import type { Propiedad } from "../domain/propiedades";

function contacto(nombre: string): Contacto {
  return {
    id: nombre,
    nombre,
    telefono: null,
    email: null,
    fuente: "Otro",
    fecha_primer_contacto: "2026-01-01",
    tipo: "Comprador",
    etapa: "Nuevo",
    temperatura: "Tibio",
    ultima_actividad: "2026-01-01",
    created_at: "2026-01-01",
  };
}

function propiedad(direccion: string): Propiedad {
  return {
    id: direccion,
    contacto_propietario_id: null,
    direccion,
    tipo_propiedad: "Departamento",
    descripcion: null,
    precio: null,
    fecha_recibida: "2026-01-01",
    condiciones: null,
    estado: "Activa",
    consultas_historicas: 0,
    visitas_historicas: 0,
    created_at: "2026-01-01",
  };
}

describe("matchContacto", () => {
  it("returns 'sin_match' when no name was mentioned", () => {
    expect(matchContacto(null, [contacto("María Gómez")])).toEqual({ type: "sin_match" });
  });

  it("returns a unique match on an exact case-insensitive substring", () => {
    const candidatos = [contacto("María Gómez"), contacto("Juan Pérez")];
    expect(matchContacto("maria", candidatos)).toEqual({
      type: "unico",
      item: candidatos[0],
    });
  });

  it("returns 'ambiguo' when more than one candidate matches", () => {
    const candidatos = [contacto("Juan Pérez"), contacto("Juan Gómez")];
    const result = matchContacto("juan", candidatos);
    expect(result.type).toBe("ambiguo");
    if (result.type === "ambiguo") {
      expect(result.candidatos).toHaveLength(2);
    }
  });

  it("returns 'sin_match' when no candidate matches", () => {
    expect(matchContacto("Roberto", [contacto("María Gómez")])).toEqual({
      type: "sin_match",
    });
  });
});

describe("matchPropiedad", () => {
  it("returns a unique match on a partial address mention", () => {
    const candidatos = [propiedad("Avenida Colón 1234"), propiedad("Calle Falsa 100")];
    expect(matchPropiedad("colon", candidatos)).toEqual({
      type: "unico",
      item: candidatos[0],
    });
  });

  it("returns 'sin_match' when nothing was mentioned or matches", () => {
    expect(matchPropiedad(null, [propiedad("Avenida Colón 1234")])).toEqual({
      type: "sin_match",
    });
    expect(matchPropiedad("inexistente", [propiedad("Avenida Colón 1234")])).toEqual({
      type: "sin_match",
    });
  });
});
