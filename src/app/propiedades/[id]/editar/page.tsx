import { notFound } from "next/navigation";
import Link from "next/link";
import { getDomainModules } from "@/lib/domain/factory";
import { ArrowLeftIcon } from "@/components/icons/ArrowLeftIcon";
import { updatePropiedadAction } from "./actions";

const TIPOS = ["Departamento", "Casa", "Lote", "Local/Oficina"] as const;
const ESTADOS = ["Activa", "Vendida", "Retirada"] as const;

const inputClass =
  "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200";
const labelClass = "block text-sm font-medium text-slate-700";

export default async function EditarPropiedadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { propiedades } = getDomainModules();
  const propiedad = await propiedades.findById(id);
  if (!propiedad) notFound();

  const updateWithId = updatePropiedadAction.bind(null, id);

  return (
    <main className="mx-auto max-w-2xl p-4">
      <Link
        href={`/propiedades/${id}`}
        className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900"
      >
        <ArrowLeftIcon className="h-4 w-4" /> Volver
      </Link>
      <h1 className="mb-6 text-xl font-semibold text-slate-900">Editar propiedad</h1>

      <form action={updateWithId} className="space-y-5">
        <div>
          <label className={labelClass} htmlFor="direccion">
            Dirección
          </label>
          <input
            id="direccion"
            name="direccion"
            type="text"
            required
            defaultValue={propiedad.direccion}
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="tipo_propiedad">
            Tipo de propiedad
          </label>
          <select
            id="tipo_propiedad"
            name="tipo_propiedad"
            defaultValue={propiedad.tipo_propiedad}
            className={inputClass}
          >
            {TIPOS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass} htmlFor="descripcion">
            Descripción
          </label>
          <textarea
            id="descripcion"
            name="descripcion"
            rows={3}
            defaultValue={propiedad.descripcion ?? ""}
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="precio">
            Precio
          </label>
          <input
            id="precio"
            name="precio"
            type="number"
            step="any"
            defaultValue={propiedad.precio ?? ""}
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="condiciones">
            Condiciones
          </label>
          <textarea
            id="condiciones"
            name="condiciones"
            rows={2}
            defaultValue={propiedad.condiciones ?? ""}
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="estado">
            Estado
          </label>
          <select
            id="estado"
            name="estado"
            defaultValue={propiedad.estado}
            className={inputClass}
          >
            {ESTADOS.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass} htmlFor="imagenes">
            Fotos (pegá un link por línea)
          </label>
          <textarea
            id="imagenes"
            name="imagenes"
            rows={4}
            placeholder={"https://...\nhttps://..."}
            defaultValue={propiedad.imagenes ?? ""}
            className={`${inputClass} font-mono text-sm`}
          />
          <p className="mt-1 text-xs text-slate-500">
            Copiá el link de cada foto (de Instagram, Facebook, el celular, etc.) y pegalo acá,
            uno por línea.
          </p>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            className="min-h-[48px] flex-1 rounded-lg bg-indigo-600 px-4 font-medium text-white transition hover:bg-indigo-700 active:scale-[0.98]"
          >
            Guardar cambios
          </button>
          <Link
            href={`/propiedades/${id}`}
            className="flex min-h-[48px] items-center justify-center rounded-lg border border-slate-300 px-4 font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancelar
          </Link>
        </div>
      </form>
    </main>
  );
}
