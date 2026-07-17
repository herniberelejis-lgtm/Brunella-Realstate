import { describe, it, expect, vi } from "vitest";
import { notificarBrunellaCompatibilidad, enviarPorWhatsApp } from "./compatibilityDocument";
import type { Propiedad } from "../domain/propiedades";
import type { Busqueda } from "../domain/busquedas";
import type { Contacto } from "../domain/contactos";

function makePropiedad(overrides: Partial<Propiedad>): Propiedad {
  return {
    id: "p1",
    contacto_propietario_id: null,
    direccion: "Bv. Illia 500",
    tipo_propiedad: "Departamento",
    descripcion: null,
    precio: 70000,
    moneda: "USD",
    codigo: null,
    dormitorios: 2,
    fecha_recibida: "2026-01-01",
    condiciones: null,
    estado: "Activa",
    consultas_historicas: 0,
    visitas_historicas: 0,
    imagenes: "https://example.com/a.jpg",
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

const busqueda: Busqueda = {
  id: "b1",
  contacto_id: "c1",
  tipo_operacion: "Compra",
  presupuesto_min: 50000,
  presupuesto_max: 90000,
  moneda: "USD",
  zona: "Nueva Córdoba",
  tipo_propiedad: "Departamento",
  dormitorios: 2,
  otros_requisitos: null,
  activa: true,
  documento_aprobado: false,
  documento_enviado: false,
  created_at: "2026-01-01T00:00:00Z",
};

const contacto: Contacto = {
  id: "c1",
  nombre: "Juan",
  telefono: "5493511234567",
  email: null,
  fuente: "Instagram",
  fecha_primer_contacto: "2026-01-01",
  tipo: "Comprador",
  etapa: "Buscando",
  temperatura: "Tibio",
  whatsapp_confirmado: false,
  ultima_actividad: "2026-01-01T00:00:00Z",
  created_at: "2026-01-01T00:00:00Z",
};

describe("notificarBrunellaCompatibilidad", () => {
  it("sends a media group and a text message with the approve button when there are matches", async () => {
    const sendMediaGroup = vi.fn().mockResolvedValue(undefined);
    const sendMessage = vi.fn().mockResolvedValue(undefined);

    await notificarBrunellaCompatibilidad(
      { sendMediaGroup, sendMessage },
      42,
      contacto,
      busqueda,
      [makePropiedad({})]
    );

    expect(sendMediaGroup).toHaveBeenCalled();
    expect(sendMessage).toHaveBeenCalledWith(
      42,
      expect.stringContaining("Juan"),
      expect.objectContaining({
        reply_markup: {
          inline_keyboard: [[{ text: "Aprobar y enviar", callback_data: `aprobar_busqueda:b1` }]],
        },
      })
    );
  });

  it("sends a text-only message explaining there are no matches yet", async () => {
    const sendMediaGroup = vi.fn().mockResolvedValue(undefined);
    const sendMessage = vi.fn().mockResolvedValue(undefined);

    await notificarBrunellaCompatibilidad({ sendMediaGroup, sendMessage }, 42, contacto, busqueda, []);

    expect(sendMediaGroup).not.toHaveBeenCalled();
    expect(sendMessage).toHaveBeenCalledWith(42, expect.stringContaining("Sin matches"));
  });
});

describe("enviarPorWhatsApp", () => {
  it("sends an image message per property plus a closing text message", async () => {
    const sendWhatsAppImage = vi.fn().mockResolvedValue(undefined);
    const sendWhatsAppText = vi.fn().mockResolvedValue(undefined);

    await enviarPorWhatsApp(
      { sendWhatsAppImage, sendWhatsAppText },
      "5493511234567",
      contacto,
      busqueda,
      [makePropiedad({})]
    );

    expect(sendWhatsAppImage).toHaveBeenCalledWith(
      "5493511234567",
      "https://example.com/a.jpg",
      expect.stringContaining("Bv. Illia 500")
    );
    expect(sendWhatsAppText).toHaveBeenCalled();
  });
});
