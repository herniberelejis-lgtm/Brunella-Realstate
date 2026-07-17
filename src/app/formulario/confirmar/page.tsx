import { notFound } from "next/navigation";
import { getDomainModules } from "@/lib/domain/factory";

export default async function ConfirmarPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>;
}) {
  const { c } = await searchParams;
  if (!c) notFound();

  const { contactos } = getDomainModules();
  const contacto = await contactos.findById(c);
  if (!contacto) notFound();

  const numeroNegocio = process.env.WHATSAPP_BUSINESS_NUMBER ?? "";
  const mensaje = encodeURIComponent(`Hola, completé el formulario - soy ${contacto.nombre}`);
  const waLink = `https://wa.me/${numeroNegocio}?text=${mensaje}`;

  return (
    <main className="mx-auto max-w-2xl p-4 text-center">
      <h1 className="mb-4 text-xl font-semibold text-slate-900">¡Gracias, {contacto.nombre}!</h1>
      <p className="mb-6 text-base text-slate-600">
        Ya recibimos tus datos. Para que podamos responderte, tocá el botón y mandanos el
        mensaje que te dejamos escrito — así arrancamos la conversación por WhatsApp.
      </p>
      <a
        href={waLink}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block min-h-[48px] rounded-lg bg-green-600 px-6 py-3 font-medium text-white hover:bg-green-700"
      >
        Confirmar por WhatsApp
      </a>
    </main>
  );
}
