import Link from "next/link";
import { getDomainModules } from "@/lib/domain/factory";
import {
  filterContactos,
  filterContactoIdsByZona,
  needsFollowUp,
  type ContactoFilters,
} from "@/lib/view/contactFilters";
import { StageBadge } from "@/components/StageBadge";
import { TemperatureBadge } from "@/components/TemperatureBadge";

const DIAS_SIN_ACTIVIDAD = 5;

export default async function ContactosPage({
  searchParams,
}: {
  searchParams: Promise<ContactoFilters & { zona?: string }>;
}) {
  const { zona, ...filters } = await searchParams;
  const { contactos, busquedas } = getDomainModules();
  const [todos, todasLasBusquedas] = await Promise.all([contactos.list(), busquedas.list()]);
  const idsConZona = filterContactoIdsByZona(todasLasBusquedas, zona);
  const filtrados = filterContactos(todos, filters).filter(
    (contacto) => idsConZona === null || idsConZona.has(contacto.id)
  );
  const ordenados = [...filtrados].sort((a, b) => {
    const aNecesita = needsFollowUp(a, DIAS_SIN_ACTIVIDAD);
    const bNecesita = needsFollowUp(b, DIAS_SIN_ACTIVIDAD);
    return aNecesita === bNecesita ? 0 : aNecesita ? -1 : 1;
  });

  return (
    <main className="mx-auto max-w-2xl p-4">
      <h1 className="mb-4 text-xl font-semibold text-slate-900">Contactos</h1>
      <ul className="space-y-2">
        {ordenados.map((contacto) => (
          <li key={contacto.id}>
            <Link
              href={`/contactos/${contacto.id}`}
              className={`block rounded-lg border p-3 transition hover:border-slate-400 ${
                needsFollowUp(contacto, DIAS_SIN_ACTIVIDAD)
                  ? "border-amber-400 bg-amber-50"
                  : "border-slate-200 bg-white"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-900">{contacto.nombre}</span>
                <span className="text-xs text-slate-500">{contacto.tipo}</span>
              </div>
              <div className="mt-1 flex gap-2">
                <StageBadge etapa={contacto.etapa} />
                <TemperatureBadge temperatura={contacto.temperatura} />
              </div>
            </Link>
          </li>
        ))}
        {ordenados.length === 0 && (
          <li className="rounded-lg border border-dashed border-slate-300 p-4 text-center text-slate-500">
            No hay contactos con esos filtros.
          </li>
        )}
      </ul>
    </main>
  );
}
