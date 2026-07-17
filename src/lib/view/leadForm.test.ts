import { describe, it, expect } from "vitest";
import { parseCompradorForm, parsePropietarioForm } from "./leadForm";

function fd(entries: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(entries)) formData.set(key, value);
  return formData;
}

describe("parseCompradorForm", () => {
  it("parses a valid comprador submission", () => {
    const result = parseCompradorForm(
      fd({
        nombre: "Juan Pérez",
        telefono: "+54 351 555-1234",
        tipo_operacion: "Compra",
        tipo_propiedad: "PH",
        zona: "Nueva Córdoba",
        presupuesto_min: "50000",
        presupuesto_max: "80000",
        moneda: "USD",
        dormitorios: "2",
        otros_requisitos: "Con cochera",
      })
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.nombre).toBe("Juan Pérez");
      expect(result.data.presupuesto_min).toBe(50000);
      expect(result.data.dormitorios).toBe(2);
    }
  });

  it("requires nombre and telefono", () => {
    const result = parseCompradorForm(fd({ tipo_operacion: "Compra" }));
    expect(result.success).toBe(false);
  });

  it("allows optional fields to be blank", () => {
    const result = parseCompradorForm(
      fd({
        nombre: "Ana",
        telefono: "+54 351 555-0000",
        tipo_operacion: "Alquiler",
        tipo_propiedad: "Departamento",
      })
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.zona).toBeNull();
      expect(result.data.presupuesto_min).toBeNull();
    }
  });
});

describe("parsePropietarioForm", () => {
  it("parses a valid propietario submission", () => {
    const result = parsePropietarioForm(
      fd({
        nombre: "Marcela",
        telefono: "+54 351 555-4321",
        que_quiere_hacer: "Vender",
        direccion: "Av. Colón 1234",
        tipo_propiedad: "Casa",
        precio: "120000",
        moneda: "USD",
        descripcion: "Casa de 3 dormitorios",
      })
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.direccion).toBe("Av. Colón 1234");
      expect(result.data.precio).toBe(120000);
    }
  });

  it("requires direccion and tipo_propiedad", () => {
    const result = parsePropietarioForm(
      fd({ nombre: "Marcela", telefono: "+54 351 555-4321", que_quiere_hacer: "Vender" })
    );
    expect(result.success).toBe(false);
  });
});
