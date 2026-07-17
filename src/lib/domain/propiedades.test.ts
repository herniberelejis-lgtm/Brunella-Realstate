import { describe, it, expect, beforeEach } from "vitest";
import { createTestPool } from "../db/testDb";
import { createPropiedadesModule } from "./propiedades";
import type { Pool } from "pg";

describe("propiedades module", () => {
  let pool: Pool;
  let propiedades: ReturnType<typeof createPropiedadesModule>;

  beforeEach(() => {
    pool = createTestPool();
    propiedades = createPropiedadesModule(pool);
  });

  it("finds properties by a fuzzy address match", async () => {
    await propiedades.create({
      direccion: "Avenida Colón 1234",
      tipo_propiedad: "Departamento",
      precio: 90000,
      moneda: "USD",
      estado: "Activa",
      consultas_historicas: 0,
      visitas_historicas: 0,
    } as any);

    const matches = await propiedades.findByDireccionLike("colon");
    expect(matches).toHaveLength(1);
    expect(matches[0].direccion).toBe("Avenida Colón 1234");
  });

  it("computes consultas_totales and visitas_totales from historical + linked records", async () => {
    const propiedad = await propiedades.create({
      direccion: "Nueva Córdoba 500",
      tipo_propiedad: "Departamento",
      precio: 120000,
      moneda: "USD",
      estado: "Activa",
      consultas_historicas: 3,
      visitas_historicas: 1,
    } as any);
    const contacto = await pool.query(
      "insert into contactos (nombre, fuente, tipo) values ('Comprador Test', 'Otro', 'Comprador') returning id"
    );
    const contactoId = contacto.rows[0].id;

    await pool.query(
      "insert into consultas (propiedad_id, contacto_id, canal) values ($1, $2, 'WhatsApp')",
      [propiedad.id, contactoId]
    );
    // interes_resultante is passed explicitly (rather than left NULL) to sidestep a pg-mem
    // limitation where CHECK constraints don't short-circuit on NULL the way real Postgres does.
    await pool.query(
      "insert into muestras (contacto_id, propiedad_id, interes_resultante) values ($1, $2, 'Indeciso')",
      [contactoId, propiedad.id]
    );
    await pool.query(
      "insert into muestras (contacto_id, propiedad_id, interes_resultante) values ($1, $2, 'Indeciso')",
      [contactoId, propiedad.id]
    );

    const withTotales = await propiedades.withTotales(propiedad);
    expect(withTotales.consultas_totales).toBe(4); // 3 historical + 1 new
    expect(withTotales.visitas_totales).toBe(3); // 1 historical + 2 new
  });
});
