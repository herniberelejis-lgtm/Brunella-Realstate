import Link from "next/link";
import { connection } from "next/server";
import { getDomainModules } from "@/lib/domain/factory";
import { UsersIcon } from "@/components/icons/UsersIcon";
import { KeyIcon } from "@/components/icons/KeyIcon";
import { BuildingIcon } from "@/components/icons/BuildingIcon";

export default async function InicioPage() {
  // Sin esto la página se prerenderiza estática en el build y los conteos quedan
  // congelados con el snapshot de la base del momento del deploy.
  await connection();
  const { contactos, propiedades } = getDomainModules();
  const [todosLosContactos, todasLasPropiedades] = await Promise.all([
    contactos.list(),
    propiedades.list(),
  ]);

  const cantidadClientes = todosLosContactos.filter(
    (c) => c.tipo === "Comprador" || c.tipo === "Ambos"
  ).length;
  const cantidadPropietarios = todosLosContactos.filter(
    (c) => c.tipo === "Propietario" || c.tipo === "Ambos"
  ).length;
  const cantidadPropiedades = todasLasPropiedades.length;

  const secciones = [
    {
      href: "/contactos?tipo=Comprador",
      titulo: "Clientes",
      subtitulo: `${cantidadClientes} ${cantidadClientes === 1 ? "cliente" : "clientes"}`,
      Icon: UsersIcon,
      color: "bg-indigo-50 text-indigo-600",
    },
    {
      href: "/contactos?tipo=Propietario",
      titulo: "Propietarios",
      subtitulo: `${cantidadPropietarios} ${cantidadPropietarios === 1 ? "propietario" : "propietarios"}`,
      Icon: KeyIcon,
      color: "bg-amber-50 text-amber-600",
    },
    {
      href: "/propiedades",
      titulo: "Propiedades",
      subtitulo: `${cantidadPropiedades} ${cantidadPropiedades === 1 ? "propiedad" : "propiedades"}`,
      Icon: BuildingIcon,
      color: "bg-emerald-50 text-emerald-600",
    },
  ];

  return (
    <main className="mx-auto max-w-2xl p-4">
      <h1 className="mb-1 text-2xl font-semibold text-slate-900">Segundo Cerebro</h1>
      <p className="mb-6 text-slate-600">¿Qué querés ver?</p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {secciones.map((s) => (
          <Link
            key={s.titulo}
            href={s.href}
            className="flex min-h-[120px] flex-col items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm transition hover:border-indigo-300 hover:shadow-md active:scale-[0.98]"
          >
            <span className={`flex h-14 w-14 items-center justify-center rounded-full ${s.color}`}>
              <s.Icon className="h-7 w-7" />
            </span>
            <span className="text-lg font-semibold text-slate-900">{s.titulo}</span>
            <span className="text-sm text-slate-500">{s.subtitulo}</span>
          </Link>
        ))}
      </div>
    </main>
  );
}
