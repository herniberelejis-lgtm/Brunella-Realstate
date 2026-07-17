"use server";

import { redirect } from "next/navigation";
import { getDomainModules } from "@/lib/domain/factory";
import { parseCompradorForm, parsePropietarioForm } from "@/lib/view/leadForm";
import { sendMediaGroup, sendMessage } from "@/lib/telegram/client";
import { createPortfolioPropioSource } from "@/lib/bot/propertyMatching";
import { notificarBrunellaCompatibilidad } from "@/lib/bot/compatibilityDocument";

async function resolveAtribucion(token: string | null) {
  if (!token) return { fuente: "Otro" as const, propiedadId: null as string | null, leadId: null as string | null };

  const { leadsPendientes, propiedades } = getDomainModules();
  const lead = await leadsPendientes.findByToken(token);
  if (!lead) return { fuente: "Otro" as const, propiedadId: null, leadId: null };

  const propiedad = lead.codigo_propiedad
    ? await propiedades.findByCodigo(lead.codigo_propiedad)
    : null;

  return { fuente: lead.canal, propiedadId: propiedad?.id ?? null, leadId: lead.id };
}

export async function submitCompradorAction(
  token: string | null,
  formData: FormData
): Promise<void> {
  const result = parseCompradorForm(formData);
  if (!result.success) {
    redirect(`/formulario?t=${token ?? ""}&error=1`);
  }
  const data = result.data;

  const { contactos, busquedas, consultas, leadsPendientes } = getDomainModules();
  const { fuente, propiedadId, leadId } = await resolveAtribucion(token);

  let contacto = await contactos.findByTelefono(data.telefono);
  if (!contacto) {
    contacto = await contactos.create({
      nombre: data.nombre,
      telefono: data.telefono,
      fuente,
      tipo: "Comprador",
      etapa: "Buscando",
      temperatura: "Tibio",
    });
  }

  const nuevaBusqueda = await busquedas.create({
    contacto_id: contacto.id,
    tipo_operacion: data.tipo_operacion,
    tipo_propiedad: data.tipo_propiedad,
    zona: data.zona,
    presupuesto_min: data.presupuesto_min,
    presupuesto_max: data.presupuesto_max,
    moneda: data.moneda,
    dormitorios: data.dormitorios,
    otros_requisitos: data.otros_requisitos,
    activa: true,
  });

  if (propiedadId) {
    await consultas.create({
      propiedad_id: propiedadId,
      contacto_id: contacto.id,
      canal: fuente === "Otro" ? "Otro" : fuente,
      origen: "formulario_cliente",
    });
  }
  if (leadId) {
    await leadsPendientes.marcarUsado(leadId);
  }

  const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (adminChatId) {
    const source = createPortfolioPropioSource(getDomainModules().propiedades);
    const matches = await source.buscar(nuevaBusqueda);
    await notificarBrunellaCompatibilidad(
      { sendMediaGroup, sendMessage },
      Number(adminChatId),
      contacto,
      nuevaBusqueda,
      matches
    );
  }

  redirect(`/formulario/confirmar?c=${contacto.id}`);
}

export async function submitPropietarioAction(
  token: string | null,
  formData: FormData
): Promise<void> {
  const result = parsePropietarioForm(formData);
  if (!result.success) {
    redirect(`/formulario?t=${token ?? ""}&tipo=propietario&error=1`);
  }
  const data = result.data;

  const { contactos, propiedades, leadsPendientes } = getDomainModules();
  const { fuente, leadId } = await resolveAtribucion(token);

  let contacto = await contactos.findByTelefono(data.telefono);
  if (!contacto) {
    contacto = await contactos.create({
      nombre: data.nombre,
      telefono: data.telefono,
      fuente,
      tipo: "Propietario",
      etapa: "Nuevo",
      temperatura: "Tibio",
    });
  }

  await propiedades.create({
    contacto_propietario_id: contacto.id,
    direccion: data.direccion,
    tipo_propiedad: data.tipo_propiedad,
    precio: data.precio,
    moneda: data.moneda,
    descripcion: data.descripcion,
    condiciones: data.que_quiere_hacer,
    estado: "Activa",
    consultas_historicas: 0,
    visitas_historicas: 0,
  });

  if (leadId) {
    await leadsPendientes.marcarUsado(leadId);
  }

  const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (adminChatId) {
    await sendMessage(
      Number(adminChatId),
      `Nueva propiedad cargada por ${contacto.nombre} (${data.que_quiere_hacer}): ${data.direccion}. Revisala en el CRM.`
    );
  }

  redirect(`/formulario/confirmar?c=${contacto.id}`);
}
