import { describe, it, expect } from "vitest";
import { parseContactoUpdate } from "./contactoForm";

function buildFormData(fields: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    formData.set(key, value);
  }
  return formData;
}

describe("parseContactoUpdate", () => {
  it("parses a valid, complete form into an update patch", () => {
    const result = parseContactoUpdate(
      buildFormData({
        nombre: "María Gómez",
        telefono: "+54 351 555-0101",
        email: "maria@example.com",
        fuente: "Instagram",
        tipo: "Comprador",
        etapa: "Buscando",
        temperatura: "Caliente",
      })
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        nombre: "María Gómez",
        telefono: "+54 351 555-0101",
        email: "maria@example.com",
        fuente: "Instagram",
        tipo: "Comprador",
        etapa: "Buscando",
        temperatura: "Caliente",
      });
    }
  });

  it("converts blank optional fields to null instead of empty strings", () => {
    const result = parseContactoUpdate(
      buildFormData({
        nombre: "Juan Pérez",
        telefono: "",
        email: "",
        fuente: "Otro",
        tipo: "Comprador",
        etapa: "Nuevo",
        temperatura: "Tibio",
      })
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.telefono).toBeNull();
      expect(result.data.email).toBeNull();
    }
  });

  it("fails when nombre is blank", () => {
    const result = parseContactoUpdate(
      buildFormData({
        nombre: "",
        fuente: "Otro",
        tipo: "Comprador",
        etapa: "Nuevo",
        temperatura: "Tibio",
      })
    );

    expect(result.success).toBe(false);
  });

  it("fails on an invalid enum value", () => {
    const result = parseContactoUpdate(
      buildFormData({
        nombre: "Juan Pérez",
        fuente: "Otro",
        tipo: "Comprador",
        etapa: "EtapaInventada",
        temperatura: "Tibio",
      })
    );

    expect(result.success).toBe(false);
  });
});
