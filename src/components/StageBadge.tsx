import type { Contacto } from "@/lib/domain/contactos";

const STAGE_STYLES: Record<Contacto["etapa"], string> = {
  Nuevo: "bg-slate-100 text-slate-700",
  Calificando: "bg-blue-100 text-blue-700",
  Buscando: "bg-indigo-100 text-indigo-700",
  "Mostrando propiedades": "bg-purple-100 text-purple-700",
  Negociando: "bg-amber-100 text-amber-700",
  "Cerrado-ganado": "bg-green-100 text-green-700",
  "Cerrado-perdido": "bg-red-100 text-red-700",
  Inactivo: "bg-gray-100 text-gray-500",
};

export function StageBadge({ etapa }: { etapa: Contacto["etapa"] }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STAGE_STYLES[etapa]}`}>
      {etapa}
    </span>
  );
}
