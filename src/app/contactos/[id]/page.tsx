import { notFound } from "next/navigation";
import { getDomainModules } from "@/lib/domain/factory";
import { StageBadge } from "@/components/StageBadge";
import { TemperatureBadge } from "@/components/TemperatureBadge";

export default async function ContactoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { contactos, busquedas, propiedades, conversaciones, muestras, ofertas } =
    getDomainModules();

  const contacto = await contactos.findById(id);
  if (!contacto) notFound();

  const [busquedasDelContacto, conversacionesDelContacto, muestrasDelContacto, ofertasDelContacto, propiedadesEnCartera] =
    await Promise.all([
      busquedas.findByContactoId(id),
      conversaciones.findByContactoId(id),
      muestras.findByContactoId(id),
      ofertas.findByContactoId(id),
      propiedades.list({ contacto_propietario_id: id } as any),
    ]);

  const timeline = [
    ...conversacionesDelContacto.map((c: any) => ({ tipo: "Conversación", fecha: c.fecha, detalle: c.resumen })),
    ...muestrasDelContacto.map((m: any) => ({ tipo: "Muestra", fecha: m.fecha, detalle: m.feedback })),
    ...ofertasDelContacto.map((o: any) => ({ tipo: "Oferta", fecha: o.fecha, detalle: `$${o.monto} (${o.estado})` })),
  ].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

  return (
    <main className="mx-auto max-w-2xl p-4">
      <h1 className="text-xl font-semibold text-slate-900">{contacto.nombre}</h1>
      <div className="mt-2 flex gap-2">
        <StageBadge etapa={contacto.etapa} />
        <TemperatureBadge temperatura={contacto.temperatura} />
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-2 text-sm text-slate-600">
        <dt>Teléfono</dt>
        <dd>{contacto.telefono ?? "—"}</dd>
        <dt>Fuente</dt>
        <dd>{contacto.fuente}</dd>
        <dt>Tipo</dt>
        <dd>{contacto.tipo}</dd>
      </dl>

      {busquedasDelContacto.length > 0 && (
        <section className="mt-6">
          <h2 className="text-sm font-semibold text-slate-700">Búsqueda activa</h2>
          {busquedasDelContacto.map((b: any) => (
            <p key={b.id} className="mt-1 text-sm text-slate-600">
              {b.tipo_operacion} · {b.tipo_propiedad} · {b.zona} · hasta ${b.presupuesto}
            </p>
          ))}
        </section>
      )}

      {propiedadesEnCartera.length > 0 && (
        <section className="mt-6">
          <h2 className="text-sm font-semibold text-slate-700">Propiedades en cartera</h2>
          {propiedadesEnCartera.map((p: any) => (
            <p key={p.id} className="mt-1 text-sm text-slate-600">
              {p.direccion} · ${p.precio} · {p.estado}
            </p>
          ))}
        </section>
      )}

      <section className="mt-6">
        <h2 className="text-sm font-semibold text-slate-700">Línea de tiempo</h2>
        <ul className="mt-2 space-y-2">
          {timeline.map((evento, index) => (
            <li key={index} className="rounded border border-slate-200 p-2 text-sm">
              <span className="font-medium">{evento.tipo}</span> —{" "}
              {new Date(evento.fecha).toLocaleDateString("es-AR")}
              <p className="text-slate-600">{evento.detalle}</p>
            </li>
          ))}
          {timeline.length === 0 && (
            <li className="text-sm text-slate-500">Todavía no hay actividad registrada.</li>
          )}
        </ul>
      </section>
    </main>
  );
}
