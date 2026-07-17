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

const { sendMediaGroup, sendMessage } = vi.hoisted(() => ({
  sendMediaGroup: vi.fn().mockResolvedValue(undefined),
  sendMessage: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/telegram/client", () => ({ sendMediaGroup, sendMessage }));

import { submitCompradorAction, submitPropietarioAction } from "./actions";
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

  it("notifies Brunella on Telegram with the compatibility results after creating the busqueda", async () => {
    process.env.TELEGRAM_ADMIN_CHAT_ID = "999";
    contactosFindByTelefono.mockResolvedValue(null);
    contactosCreate.mockResolvedValue({ id: "contacto-3", nombre: "Marcos", telefono: "54935111" });
    const nuevaBusqueda = {
      id: "busqueda-1",
      contacto_id: "contacto-3",
      tipo_operacion: "Compra",
      tipo_propiedad: "PH",
      presupuesto_min: null,
      presupuesto_max: null,
      moneda: null,
      zona: null,
      dormitorios: null,
      otros_requisitos: null,
      activa: true,
      documento_aprobado: false,
      documento_enviado: false,
      created_at: "2026-01-01T00:00:00Z",
    };
    busquedasCreate.mockResolvedValue(nuevaBusqueda);
    // Exercise the "matches found" branch (not the empty-array default): one active PH
    // property with a photo, so notificarBrunellaCompatibilidad takes its media-group path.
    propiedadesList.mockResolvedValue([
      {
        id: "propiedad-1",
        contacto_propietario_id: null,
        direccion: "Nueva Córdoba 500",
        tipo_propiedad: "PH",
        descripcion: null,
        precio: 90000,
        moneda: "USD",
        codigo: null,
        dormitorios: 2,
        fecha_recibida: "2026-01-01",
        condiciones: null,
        estado: "Activa",
        consultas_historicas: 0,
        visitas_historicas: 0,
        imagenes: "https://example.com/foto.jpg",
        created_at: "2026-01-01T00:00:00Z",
      },
    ]);

    await expect(
      submitCompradorAction(
        null,
        fd({
          nombre: "Marcos",
          telefono: "54935111",
          tipo_operacion: "Compra",
          tipo_propiedad: "PH",
        })
      )
    ).rejects.toThrow("REDIRECT");

    expect(sendMediaGroup).toHaveBeenCalledWith(
      999,
      expect.arrayContaining([expect.objectContaining({ url: "https://example.com/foto.jpg" })])
    );
    expect(sendMessage).toHaveBeenCalledWith(
      999,
      expect.stringContaining("Nueva Córdoba 500"),
      expect.objectContaining({
        reply_markup: {
          inline_keyboard: [[{ text: "Aprobar y enviar", callback_data: "aprobar_busqueda:busqueda-1" }]],
        },
      })
    );
  });

  it("does not let a Telegram notification failure break the client's submission", async () => {
    process.env.TELEGRAM_ADMIN_CHAT_ID = "999";
    contactosFindByTelefono.mockResolvedValue(null);
    contactosCreate.mockResolvedValue({ id: "contacto-5", nombre: "Lucía", telefono: "54935113" });
    busquedasCreate.mockResolvedValue({ id: "busqueda-2", contacto_id: "contacto-5" });
    propiedadesList.mockResolvedValue([]);
    sendMessage.mockRejectedValueOnce(new Error("Telegram is down"));

    await expect(
      submitCompradorAction(
        null,
        fd({
          nombre: "Lucía",
          telefono: "54935113",
          tipo_operacion: "Compra",
          tipo_propiedad: "PH",
        })
      )
    ).rejects.toThrow("REDIRECT");

    expect(redirect).toHaveBeenCalledWith("/formulario/confirmar?c=contacto-5");
  });
});

describe("submitPropietarioAction", () => {
  beforeEach(() => vi.clearAllMocks());

  it("notifies Brunella on Telegram that a new property was submitted", async () => {
    process.env.TELEGRAM_ADMIN_CHAT_ID = "999";
    contactosFindByTelefono.mockResolvedValue(null);
    contactosCreate.mockResolvedValue({ id: "contacto-4", nombre: "Marcela" });

    await expect(
      submitPropietarioAction(
        null,
        fd({
          nombre: "Marcela",
          telefono: "54935112",
          que_quiere_hacer: "Vender",
          direccion: "Colón 1234",
          tipo_propiedad: "Casa",
        })
      )
    ).rejects.toThrow("REDIRECT");

    expect(sendMessage).toHaveBeenCalledWith(
      999,
      expect.stringContaining("Marcela")
    );
  });
});
