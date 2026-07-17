import { CompradorForm } from "./CompradorForm";
import { PropietarioForm } from "./PropietarioForm";

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
    <main className="mx-auto max-w-2xl p-4">
      <h1 className="mb-6 text-xl font-semibold text-slate-900">¿Qué estás buscando?</h1>
      <div className="space-y-3">
        <a
          href={`/formulario?tipo=comprador${token ? `&t=${token}` : ""}`}
          className="block min-h-[56px] rounded-lg border border-slate-200 bg-white p-4 text-center text-base font-medium text-slate-900 hover:border-indigo-400"
        >
          Quiero comprar o alquilar una propiedad
        </a>
        <a
          href={`/formulario?tipo=propietario${token ? `&t=${token}` : ""}`}
          className="block min-h-[56px] rounded-lg border border-slate-200 bg-white p-4 text-center text-base font-medium text-slate-900 hover:border-indigo-400"
        >
          Quiero publicar mi propiedad (vender o alquilar)
        </a>
      </div>
    </main>
  );
}
