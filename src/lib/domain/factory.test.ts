import { describe, it, expect, afterEach, vi } from "vitest";
import { getDomainModules } from "./factory";

describe("getDomainModules", () => {
  const originalDatabaseUrl = process.env.DATABASE_URL;

  afterEach(() => {
    process.env.DATABASE_URL = originalDatabaseUrl;
  });

  it("returns seeded in-memory data when DATABASE_URL is not set", async () => {
    delete process.env.DATABASE_URL;
    const modules = getDomainModules();
    const contactos = await modules.contactos.list();
    expect(contactos.length).toBeGreaterThan(0);
  });

  it("returns the same in-memory instance across calls in one process", () => {
    delete process.env.DATABASE_URL;
    const first = getDomainModules();
    const second = getDomainModules();
    expect(first.contactos).toBe(second.contactos);
  });

  it("returns Postgres-backed modules (not the in-memory ones) when DATABASE_URL is set", async () => {
    process.env.DATABASE_URL = "postgres://user:pass@localhost:5432/test";
    vi.resetModules();
    const { getDomainModules: freshGetDomainModules } = await import("./factory");
    const modules = freshGetDomainModules();
    // The in-memory implementation always resolves with the seeded fixtures; a
    // pool-backed module built against a non-existent DB will reject instead.
    await expect(modules.contactos.list()).rejects.toThrow();
  });

  it("exercises every in-memory wrapper method across all seven entities", async () => {
    delete process.env.DATABASE_URL;
    vi.resetModules();
    const { getDomainModules: freshGetDomainModules } = await import("./factory");
    const modules = freshGetDomainModules();

    const contacto = await modules.contactos.create({
      nombre: "Test In-Memory",
      telefono: null,
      email: null,
      fuente: "Otro",
      fecha_primer_contacto: "2026-01-01",
      tipo: "Comprador",
      etapa: "Nuevo",
      temperatura: "Tibio",
      ultima_actividad: "2026-01-01",
      created_at: "2026-01-01",
    } as any);
    expect(await modules.contactos.findByNombreLike("in-memory")).toHaveLength(1);
    expect(await modules.contactos.findNecesitanSeguimiento(5)).toEqual([]);
    await modules.contactos.marcarActividad(contacto.id);

    const propiedad = await modules.propiedades.create({
      contacto_propietario_id: null,
      direccion: "Test Address 123",
      tipo_propiedad: "Departamento",
      descripcion: null,
      precio: 1000,
      fecha_recibida: "2026-01-01",
      condiciones: null,
      estado: "Activa",
      consultas_historicas: 1,
      visitas_historicas: 1,
      created_at: "2026-01-01",
    } as any);
    expect(await modules.propiedades.findByDireccionLike("test address")).toHaveLength(1);
    const conTotales = await modules.propiedades.withTotales(propiedad);
    expect(conTotales.consultas_totales).toBe(1);

    const busqueda = await modules.busquedas.create({ contacto_id: contacto.id } as any);
    expect(await modules.busquedas.findByContactoId(contacto.id)).toContainEqual(busqueda);

    const conversacion = await modules.conversaciones.create({ contacto_id: contacto.id } as any);
    expect(await modules.conversaciones.findByContactoId(contacto.id)).toContainEqual(conversacion);

    const muestra = await modules.muestras.create({
      contacto_id: contacto.id,
      propiedad_id: propiedad.id,
    } as any);
    expect(await modules.muestras.findByContactoId(contacto.id)).toContainEqual(muestra);
    expect(await modules.muestras.findByPropiedadId(propiedad.id)).toContainEqual(muestra);

    const consulta = await modules.consultas.create({
      contacto_id: contacto.id,
      propiedad_id: propiedad.id,
    } as any);
    expect(await modules.consultas.findByContactoId(contacto.id)).toContainEqual(consulta);
    expect(await modules.consultas.findByPropiedadId(propiedad.id)).toContainEqual(consulta);

    const oferta = await modules.ofertas.create({
      contacto_id: contacto.id,
      propiedad_id: propiedad.id,
    } as any);
    expect(await modules.ofertas.findByContactoId(contacto.id)).toContainEqual(oferta);
    expect(await modules.ofertas.findByPropiedadId(propiedad.id)).toContainEqual(oferta);
  });
});
