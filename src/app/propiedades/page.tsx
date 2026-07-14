import Link from "next/link";
import { getDomainModules } from "@/lib/domain/factory";

export default async function PropiedadesPage() {
  const { propiedades } = getDomainModules();
  const todas = await propiedades.list();
  const conTotales = await Promise.all(todas.map((p: any) => propiedades.withTotales(p)));

  return (
    <main className="mx-auto max-w-2xl p-4">
      <h1 className="mb-4 text-xl font-semibold text-slate-900">Propiedades</h1>
      <ul className="space-y-2">
        {conTotales.map((propiedad: any) => (
          <li key={propiedad.id}>
            <Link
              href={`/propiedades/${propiedad.id}`}
              className="block rounded-lg border border-slate-200 bg-white p-3 hover:border-slate-400"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-900">{propiedad.direccion}</span>
                <span className="text-xs text-slate-500">{propiedad.estado}</span>
              </div>
              <p className="mt-1 text-sm text-slate-600">
                ${propiedad.precio ?? "—"} · {propiedad.consultas_totales} consultas ·{" "}
                {propiedad.visitas_totales} visitas
              </p>
            </Link>
          </li>
        ))}
        {conTotales.length === 0 && (
          <li className="rounded-lg border border-dashed border-slate-300 p-4 text-center text-slate-500">
            Todavía no hay propiedades cargadas.
          </li>
        )}
      </ul>
    </main>
  );
}
