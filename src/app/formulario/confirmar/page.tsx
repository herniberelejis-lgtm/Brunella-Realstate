import { notFound } from "next/navigation";
import { getDomainModules } from "@/lib/domain/factory";
import { BrandMark } from "../BrandMark";

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
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-4 py-14 text-center">
      <BrandMark />
      <h1 className="mt-6 font-[family-name:var(--font-fraunces)] text-3xl text-[#2B2620] sm:text-4xl">
        ¡Gracias, {contacto.nombre}!
      </h1>
      <p className="mx-auto mt-4 max-w-md text-base leading-relaxed text-[#6B5F4C]">
        Ya recibimos tus datos. Para que podamos responderte, tocá el botón y mandanos el mensaje
        que te dejamos escrito — así arrancamos la conversación por WhatsApp.
      </p>
      <a
        href={waLink}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-8 inline-block min-h-[52px] rounded-full bg-[#25D366] px-8 py-3.5 text-sm font-semibold uppercase tracking-[0.14em] text-white shadow-[0_8px_30px_rgba(37,211,102,0.25)] transition hover:bg-[#1EBE5A] active:scale-[0.99]"
      >
        Confirmar por WhatsApp
      </a>
    </main>
  );
}
