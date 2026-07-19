import { CompradorForm } from "./CompradorForm";
import { PropietarioForm } from "./PropietarioForm";
import { BrandMark } from "./BrandMark";

export default async function FormularioPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string; tipo?: string; error?: string }>;
}) {
  const { t, tipo, error } = await searchParams;
  const token = t ?? null;

  if (tipo === "propietario") {
    return <PropietarioForm token={token} showError={error === "1"} />;
  }
  if (tipo === "comprador") {
    return <CompradorForm token={token} showError={error === "1"} />;
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 sm:py-14">
      <div className="mb-10 flex flex-col items-center gap-6 text-center">
        <BrandMark />
        <h1 className="font-[family-name:var(--font-fraunces)] text-3xl text-[#2B2620] sm:text-4xl">
          ¿Qué estás buscando?
        </h1>
      </div>
      <div className="space-y-4">
        <a
          href={`/formulario?tipo=comprador${token ? `&t=${token}` : ""}`}
          className="block min-h-[64px] rounded-2xl border border-[#EFE3CE] bg-white/80 p-5 text-center shadow-[0_8px_30px_rgba(120,95,40,0.08)] transition hover:border-[#C9A24B]"
        >
          <span className="font-[family-name:var(--font-fraunces)] text-lg text-[#2B2620]">
            Quiero comprar o alquilar una propiedad
          </span>
        </a>
        <a
          href={`/formulario?tipo=propietario${token ? `&t=${token}` : ""}`}
          className="block min-h-[64px] rounded-2xl border border-[#EFE3CE] bg-white/80 p-5 text-center shadow-[0_8px_30px_rgba(120,95,40,0.08)] transition hover:border-[#C9A24B]"
        >
          <span className="font-[family-name:var(--font-fraunces)] text-lg text-[#2B2620]">
            Quiero publicar mi propiedad (vender o alquilar)
          </span>
        </a>
      </div>
    </main>
  );
}
