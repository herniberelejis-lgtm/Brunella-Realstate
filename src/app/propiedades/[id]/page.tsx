import { notFound } from "next/navigation";
import { getDomainModules } from "@/lib/domain/factory";
import type { Consulta } from "@/lib/domain/consultas";
import type { Muestra } from "@/lib/domain/muestras";
import type { Oferta } from "@/lib/domain/ofertas";

export default async function PropiedadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { propiedades, contactos, consultas, muestras, ofertas } = getDomainModules();

  const propiedad = await propiedades.findById(id);
  if (!propiedad) notFound();

  const [conTotales, propietario, consultasDeLaPropiedad, muestrasDeLaPropiedad, ofertasDeLaPropiedad] =
    await Promise.all([
      propiedades.withTotales(propiedad),
      propiedad.contacto_propietario_id
        ? contactos.findById(propiedad.contacto_propietario_id)
        : Promise.resolve(null),
      consultas.findByPropiedadId(id),
      muestras.findByPropiedadId(id),
      ofertas.findByPropiedadId(id),
    ]);

  return (
    <main className="mx-auto max-w-2xl p-4">
      <h1 className="text-xl font-semibold text-slate-900">{propiedad.direccion}</h1>
      <p className="mt-1 text-sm text-slate-600">
        {propiedad.tipo_propiedad} · ${propiedad.precio ?? "—"} · {propiedad.estado}
      </p>
      {propietario && (
        <p className="mt-2 text-sm text-slate-600">
          Propietario: <span className="font-medium">{propietario.nombre}</span>
        </p>
      )}

      <dl className="mt-4 grid grid-cols-2 gap-2 text-sm text-slate-600">
        <dt>Consultas totales</dt>
        <dd>{conTotales.consultas_totales}</dd>
        <dt>Visitas totales</dt>
        <dd>{conTotales.visitas_totales}</dd>
        <dt>Ofertas</dt>
        <dd>{ofertasDeLaPropiedad.length}</dd>
      </dl>

      <section className="mt-6">
        <h2 className="text-sm font-semibold text-slate-700">Historial de consultas</h2>
        <ul className="mt-2 space-y-1 text-sm text-slate-600">
          {consultasDeLaPropiedad.map((c: Consulta) => (
            <li key={c.id}>
              {new Date(c.fecha).toLocaleDateString("es-AR")} — {c.canal}
            </li>
          ))}
          {consultasDeLaPropiedad.length === 0 && <li>Todavía no hay consultas.</li>}
        </ul>
      </section>

      <section className="mt-6">
        <h2 className="text-sm font-semibold text-slate-700">Historial de muestras</h2>
        <ul className="mt-2 space-y-1 text-sm text-slate-600">
          {muestrasDeLaPropiedad.map((m: Muestra) => (
            <li key={m.id}>
              {new Date(m.fecha).toLocaleDateString("es-AR")} — {m.feedback ?? "sin feedback"} (
              {m.interes_resultante ?? "sin definir"})
            </li>
          ))}
          {muestrasDeLaPropiedad.length === 0 && <li>Todavía no se mostró a nadie.</li>}
        </ul>
      </section>

      <section className="mt-6">
        <h2 className="text-sm font-semibold text-slate-700">Ofertas recibidas</h2>
        <ul className="mt-2 space-y-1 text-sm text-slate-600">
          {ofertasDeLaPropiedad.map((o: Oferta) => (
            <li key={o.id}>
              ${o.monto} — {o.estado} ({new Date(o.fecha).toLocaleDateString("es-AR")})
            </li>
          ))}
          {ofertasDeLaPropiedad.length === 0 && <li>Todavía no hay ofertas.</li>}
        </ul>
      </section>
    </main>
  );
}
