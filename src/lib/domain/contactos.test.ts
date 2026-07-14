import { describe, it, expect, beforeEach } from "vitest";
import { createTestPool } from "../db/testDb";
import { createContactosModule } from "./contactos";
import type { Pool } from "pg";

describe("contactos module", () => {
  let pool: Pool;
  let contactos: ReturnType<typeof createContactosModule>;

  beforeEach(() => {
    pool = createTestPool();
    contactos = createContactosModule(pool);
  });

  it("finds contacts by a fuzzy name match", async () => {
    await contactos.create({
      nombre: "María Gómez",
      fuente: "Instagram",
      tipo: "Comprador",
      etapa: "Nuevo",
      temperatura: "Tibio",
    } as any);
    await contactos.create({
      nombre: "Juan Pérez",
      fuente: "Facebook",
      tipo: "Comprador",
      etapa: "Nuevo",
      temperatura: "Tibio",
    } as any);

    const matches = await contactos.findByNombreLike("maria");
    expect(matches).toHaveLength(1);
    expect(matches[0].nombre).toBe("María Gómez");
  });

  it("finds contacts needing follow-up: stale and not closed/inactive", async () => {
    const stale = await contactos.create({
      nombre: "Stale Contact",
      fuente: "Otro",
      tipo: "Comprador",
      etapa: "Buscando",
      temperatura: "Tibio",
    } as any);
    await pool.query(
      "update contactos set ultima_actividad = now() - interval '10 days' where id = $1",
      [stale.id]
    );

    const fresh = await contactos.create({
      nombre: "Fresh Contact",
      fuente: "Otro",
      tipo: "Comprador",
      etapa: "Buscando",
      temperatura: "Tibio",
    } as any);
    await pool.query(
      "update contactos set ultima_actividad = now() - interval '1 day' where id = $1",
      [fresh.id]
    );

    const closedStale = await contactos.create({
      nombre: "Closed Stale Contact",
      fuente: "Otro",
      tipo: "Comprador",
      etapa: "Cerrado-ganado",
      temperatura: "Tibio",
    } as any);
    await pool.query(
      "update contactos set ultima_actividad = now() - interval '30 days' where id = $1",
      [closedStale.id]
    );

    const needSeguimiento = await contactos.findNecesitanSeguimiento(5);
    expect(needSeguimiento.map((c) => c.nombre)).toEqual(["Stale Contact"]);
  });

  it("marcarActividad updates ultima_actividad to now", async () => {
    const contacto = await contactos.create({
      nombre: "Contacto Reciente",
      fuente: "Otro",
      tipo: "Comprador",
      etapa: "Buscando",
      temperatura: "Tibio",
    } as any);
    await pool.query(
      "update contactos set ultima_actividad = now() - interval '10 days' where id = $1",
      [contacto.id]
    );

    await contactos.marcarActividad(contacto.id);

    const actualizado = await contactos.findById(contacto.id);
    const ultimaActividad = new Date(actualizado!.ultima_actividad).getTime();
    expect(Date.now() - ultimaActividad).toBeLessThan(60_000);
  });
});
