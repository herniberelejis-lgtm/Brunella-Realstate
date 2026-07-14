import Link from "next/link";
import { getDomainModules } from "@/lib/domain/factory";
import { parseImagenes } from "@/lib/view/imagenes";
import { PhotoIcon } from "@/components/icons/PhotoIcon";
import type { PropiedadConTotales } from "@/lib/domain/propiedades";

export default async function PropiedadesPage() {
  const { propiedades } = getDomainModules();
  const todas = await propiedades.list();
  const conTotales = await Promise.all(todas.map((p) => propiedades.withTotales(p)));

  return (
    <main className="mx-auto max-w-2xl p-4">
      <h1 className="mb-4 text-xl font-semibold text-slate-900">Propiedades</h1>
      <ul className="space-y-2">
        {conTotales.map((propiedad: PropiedadConTotales) => {
          const primeraFoto = parseImagenes(propiedad.imagenes)[0];
          return (
            <li key={propiedad.id}>
              <Link
                href={`/propiedades/${propiedad.id}`}
                className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 hover:border-slate-400"
              >
                {primeraFoto ? (
                  // eslint-disable-next-line @next/next/no-img-element -- arbitrary external hosts
                  <img
                    src={primeraFoto}
                    alt=""
                    loading="lazy"
                    className="h-14 w-14 shrink-0 rounded-lg object-cover"
                  />
                ) : (
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
                    <PhotoIcon className="h-6 w-6" />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium text-slate-900">
                      {propiedad.direccion}
                    </span>
                    <span className="shrink-0 text-xs text-slate-500">{propiedad.estado}</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">
                    ${propiedad.precio ?? "—"} · {propiedad.consultas_totales} consultas ·{" "}
                    {propiedad.visitas_totales} visitas
                  </p>
                </div>
              </Link>
            </li>
          );
        })}
        {conTotales.length === 0 && (
          <li className="rounded-lg border border-dashed border-slate-300 p-4 text-center text-slate-500">
            Todavía no hay propiedades cargadas.
          </li>
        )}
      </ul>
    </main>
  );
}
