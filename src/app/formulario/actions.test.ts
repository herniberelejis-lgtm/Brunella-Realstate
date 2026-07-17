import { describe, it, expect, vi, beforeEach } from "vitest";

const contactosFindByTelefono = vi.fn().mockResolvedValue(null);
const contactosCreate = vi.fn().mockResolvedValue({ id: "contacto-1", nombre: "Juan" });
const busquedasCreate = vi.fn().mockResolvedValue({ id: "busqueda-1" });
const propiedadesFindByCodigo = vi.fn().mockResolvedValue(null);
// `list` is unused until Task 15 wires in the matching engine, but it's declared here (rather
// than added later) so every test in this file shares one mock shape — Task 15 only needs to
// set its return value per-test, not restructure this mock.
const propiedadesList = vi.fn().mockResolvedValue([]);
const consultasCreate = vi.fn().mockResolvedValue({ id: "consulta-1" });
const leadsPendientesFindByToken = vi.fn().mockResolvedValue(null);
const leadsPendientesMarcarUsado = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/domain/factory", () => ({
  getDomainModules: () => ({
    contactos: { findByTelefono: contactosFindByTelefono, create: contactosCreate },
    busquedas: { create: busquedasCreate },
    propiedades: { findByCodigo: propiedadesFindByCodigo, create: vi.fn(), list: propiedadesList },
    consultas: { create: consultasCreate },
    leadsPendientes: {
      findByToken: leadsPendientesFindByToken,
      marcarUsado: leadsPendientesMarcarUsado,
    },
  }),
}));

vi.mock("next/navigation", () => ({ redirect: vi.fn(() => { throw new Error("REDIRECT"); }) }));

import { submitCompradorAction } from "./actions";
import { redirect } from "next/navigation";

function fd(entries: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(entries)) formData.set(key, value);
  return formData;
}

describe("submitCompradorAction", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a new contacto and busqueda, and redirects to the confirmation page", async () => {
    contactosFindByTelefono.mockResolvedValue(null);
    contactosCreate.mockResolvedValue({ id: "contacto-1", nombre: "Juan" });

    await expect(
      submitCompradorAction(
        null,
        fd({
          nombre: "Juan",
          telefono: "+54 351 555-1234",
          tipo_operacion: "Compra",
          tipo_propiedad: "PH",
        })
      )
    ).rejects.toThrow("REDIRECT");

    expect(contactosCreate).toHaveBeenCalledWith(
      expect.objectContaining({ nombre: "Juan", tipo: "Comprador", fuente: "Otro" })
    );
    expect(busquedasCreate).toHaveBeenCalledWith(
      expect.objectContaining({ contacto_id: "contacto-1", tipo_operacion: "Compra" })
    );
    expect(redirect).toHaveBeenCalledWith("/formulario/confirmar?c=contacto-1");
  });

  it("reuses an existing contacto with the same phone instead of duplicating", async () => {
    contactosFindByTelefono.mockResolvedValue({ id: "contacto-existing", nombre: "Juan" });

    await expect(
      submitCompradorAction(
        null,
        fd({
          nombre: "Juan",
          telefono: "+54 351 555-1234",
          tipo_operacion: "Compra",
          tipo_propiedad: "PH",
        })
      )
    ).rejects.toThrow("REDIRECT");

    expect(contactosCreate).not.toHaveBeenCalled();
    expect(busquedasCreate).toHaveBeenCalledWith(
      expect.objectContaining({ contacto_id: "contacto-existing" })
    );
  });

  it("resolves attribution from the token and links the consulta to the matched property", async () => {
    contactosFindByTelefono.mockResolvedValue(null);
    contactosCreate.mockResolvedValue({ id: "contacto-2", nombre: "Ana" });
    leadsPendientesFindByToken.mockResolvedValue({
      id: "lead-1",
      canal: "Instagram",
      codigo_propiedad: "COD-TEST",
    });
    propiedadesFindByCodigo.mockResolvedValue({ id: "propiedad-1" });

    await expect(
      submitCompradorAction(
        "tok-123",
        fd({
          nombre: "Ana",
          telefono: "+54 351 555-9999",
          tipo_operacion: "Alquiler",
          tipo_propiedad: "Departamento",
        })
      )
    ).rejects.toThrow("REDIRECT");

    expect(contactosCreate).toHaveBeenCalledWith(
      expect.objectContaining({ fuente: "Instagram" })
    );
    expect(consultasCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        propiedad_id: "propiedad-1",
        contacto_id: "contacto-2",
        canal: "Instagram",
        origen: "formulario_cliente",
      })
    );
    expect(leadsPendientesMarcarUsado).toHaveBeenCalledWith("lead-1");
  });
});
