import { notFound } from "next/navigation";
import Link from "next/link";
import { getDomainModules } from "@/lib/domain/factory";
import { ArrowLeftIcon } from "@/components/icons/ArrowLeftIcon";
import { updateContactoAction } from "./actions";

const FUENTES = ["Instagram", "Facebook", "Zonaprop", "Grupo Banker", "Referido", "Otro"] as const;
const TIPOS = ["Comprador", "Propietario", "Ambos"] as const;
const ETAPAS = [
  "Nuevo",
  "Calificando",
  "Buscando",
  "Mostrando propiedades",
  "Negociando",
  "Cerrado-ganado",
  "Cerrado-perdido",
  "Inactivo",
] as const;
const TEMPERATURAS = ["Frio", "Tibio", "Caliente"] as const;

const inputClass =
  "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200";
const labelClass = "block text-sm font-medium text-slate-700";

export default async function EditarContactoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { contactos } = getDomainModules();
  const contacto = await contactos.findById(id);
  if (!contacto) notFound();

  const updateWithId = updateContactoAction.bind(null, id);

  return (
    <main className="mx-auto max-w-2xl p-4">
      <Link
        href={`/contactos/${id}`}
        className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900"
      >
        <ArrowLeftIcon className="h-4 w-4" /> Volver
      </Link>
      <h1 className="mb-6 text-xl font-semibold text-slate-900">Editar contacto</h1>

      <form action={updateWithId} className="space-y-5">
        <div>
          <label className={labelClass} htmlFor="nombre">
            Nombre
          </label>
          <input
            id="nombre"
            name="nombre"
            type="text"
            required
            defaultValue={contacto.nombre}
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="telefono">
            Teléfono
          </label>
          <input
            id="telefono"
            name="telefono"
            type="text"
            defaultValue={contacto.telefono ?? ""}
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="email">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            defaultValue={contacto.email ?? ""}
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="fuente">
            Fuente
          </label>
          <select id="fuente" name="fuente" defaultValue={contacto.fuente} className={inputClass}>
            {FUENTES.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass} htmlFor="tipo">
            Tipo
          </label>
          <select id="tipo" name="tipo" defaultValue={contacto.tipo} className={inputClass}>
            {TIPOS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass} htmlFor="etapa">
            Etapa
          </label>
          <select id="etapa" name="etapa" defaultValue={contacto.etapa} className={inputClass}>
            {ETAPAS.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass} htmlFor="temperatura">
            Temperatura
          </label>
          <select
            id="temperatura"
            name="temperatura"
            defaultValue={contacto.temperatura}
            className={inputClass}
          >
            {TEMPERATURAS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            className="min-h-[48px] flex-1 rounded-lg bg-indigo-600 px-4 font-medium text-white transition hover:bg-indigo-700 active:scale-[0.98]"
          >
            Guardar cambios
          </button>
          <Link
            href={`/contactos/${id}`}
            className="flex min-h-[48px] items-center justify-center rounded-lg border border-slate-300 px-4 font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancelar
          </Link>
        </div>
      </form>
    </main>
  );
}
