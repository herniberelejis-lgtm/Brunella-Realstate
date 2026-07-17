import { describe, it, expect, vi, beforeEach } from "vitest";

const busquedasFindById = vi.fn();
const busquedasUpdate = vi.fn().mockResolvedValue({});
const contactosFindById = vi.fn();
const propiedadesList = vi.fn().mockResolvedValue([]);

vi.mock("@/lib/domain/factory", () => ({
  getDomainModules: () => ({
    busquedas: { findById: busquedasFindById, update: busquedasUpdate },
    contactos: { findById: contactosFindById },
    propiedades: { list: propiedadesList },
  }),
}));

const { mockSendWhatsAppImage, mockSendWhatsAppText } = vi.hoisted(() => ({
  mockSendWhatsAppImage: vi.fn().mockResolvedValue(undefined),
  mockSendWhatsAppText: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/whatsapp/client", () => ({
  sendWhatsAppImage: mockSendWhatsAppImage,
  sendWhatsAppText: mockSendWhatsAppText,
}));

import { enviarDocumentoAprobado } from "./enviarDocumentoAprobado";

describe("enviarDocumentoAprobado", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    busquedasFindById.mockResolvedValue({
      id: "b1",
      contacto_id: "c1",
      tipo_propiedad: "Departamento",
      presupuesto_min: null,
      presupuesto_max: null,
      moneda: null,
      zona: null,
      dormitorios: null,
      documento_aprobado: true,
      documento_enviado: false,
    });
    contactosFindById.mockResolvedValue({ id: "c1", nombre: "Juan", telefono: "5493511234567" });
    propiedadesList.mockResolvedValue([]);
  });

  it("sends the document over WhatsApp and marks it as enviado", async () => {
    await enviarDocumentoAprobado("b1");

    expect(mockSendWhatsAppText).toHaveBeenCalled();
    expect(busquedasUpdate).toHaveBeenCalledWith("b1", { documento_enviado: true });
  });

  it("does nothing if the busqueda no longer exists", async () => {
    busquedasFindById.mockResolvedValue(null);
    await enviarDocumentoAprobado("missing");
    expect(mockSendWhatsAppText).not.toHaveBeenCalled();
  });
});
