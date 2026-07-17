import { getDomainModules } from "@/lib/domain/factory";
import { sendWhatsAppImage, sendWhatsAppText } from "@/lib/whatsapp/client";
import { createPortfolioPropioSource } from "./propertyMatching";
import { enviarPorWhatsApp } from "./compatibilityDocument";

export async function enviarDocumentoAprobado(busquedaId: string): Promise<void> {
  const { busquedas, contactos, propiedades } = getDomainModules();

  const busqueda = await busquedas.findById(busquedaId);
  if (!busqueda) return;

  const contacto = await contactos.findById(busqueda.contacto_id);
  if (!contacto || !contacto.telefono) return;

  const source = createPortfolioPropioSource(propiedades);
  const matches = await source.buscar(busqueda);

  await enviarPorWhatsApp(
    { sendWhatsAppImage, sendWhatsAppText },
    contacto.telefono,
    contacto,
    busqueda,
    matches
  );

  await busquedas.update(busquedaId, { documento_enviado: true });
}
