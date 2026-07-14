import { describe, it, expect } from "vitest";
import { parsePropiedadUpdate } from "./propiedadForm";

function buildFormData(fields: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    formData.set(key, value);
  }
  return formData;
}

describe("parsePropiedadUpdate", () => {
  it("parses a valid, complete form into an update patch", () => {
    const result = parsePropiedadUpdate(
      buildFormData({
        direccion: "Nueva Córdoba 500",
        tipo_propiedad: "Departamento",
        descripcion: "2 dormitorios",
        precio: "120000",
        condiciones: "Exclusividad 90 días",
        estado: "Activa",
        imagenes: "https://a.com/1.jpg\nhttps://a.com/2.jpg",
      })
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        direccion: "Nueva Córdoba 500",
        tipo_propiedad: "Departamento",
        descripcion: "2 dormitorios",
        precio: 120000,
        condiciones: "Exclusividad 90 días",
        estado: "Activa",
        imagenes: "https://a.com/1.jpg\nhttps://a.com/2.jpg",
      });
    }
  });

  it("converts blank optional fields to null, and blank precio to null (not 0 or NaN)", () => {
    const result = parsePropiedadUpdate(
      buildFormData({
        direccion: "Calle Falsa 123",
        tipo_propiedad: "Lote",
        descripcion: "",
        precio: "",
        condiciones: "",
        estado: "Activa",
        imagenes: "",
      })
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.descripcion).toBeNull();
      expect(result.data.precio).toBeNull();
      expect(result.data.condiciones).toBeNull();
      expect(result.data.imagenes).toBeNull();
    }
  });

  it("fails when direccion is blank", () => {
    const result = parsePropiedadUpdate(
      buildFormData({
        direccion: "",
        tipo_propiedad: "Lote",
        estado: "Activa",
      })
    );

    expect(result.success).toBe(false);
  });

  it("fails when precio is not a valid number", () => {
    const result = parsePropiedadUpdate(
      buildFormData({
        direccion: "Calle Falsa 123",
        tipo_propiedad: "Lote",
        estado: "Activa",
        precio: "no es un numero",
      })
    );

    expect(result.success).toBe(false);
  });
});
