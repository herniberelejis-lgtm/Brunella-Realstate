import type { Contacto } from "@/lib/domain/contactos";

const TEMP_STYLES: Record<Contacto["temperatura"], string> = {
  Frio: "bg-sky-100 text-sky-700",
  Tibio: "bg-orange-100 text-orange-700",
  Caliente: "bg-rose-100 text-rose-700",
};

const TEMP_ICONS: Record<Contacto["temperatura"], string> = {
  Frio: "❄️",
  Tibio: "🌤️",
  Caliente: "🔥",
};

export function TemperatureBadge({ temperatura }: { temperatura: Contacto["temperatura"] }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${TEMP_STYLES[temperatura]}`}>
      {TEMP_ICONS[temperatura]} {temperatura}
    </span>
  );
}
