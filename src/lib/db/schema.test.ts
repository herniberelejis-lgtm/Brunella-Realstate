import { describe, it, expect, beforeAll } from "vitest";
import { newDb } from "pg-mem";
import fs from "node:fs";
import path from "node:path";
import { createTestPool } from "./testDb";

function loadTestDb() {
  const db = newDb({ autoCreateForeignKeyIndices: true });
  db.public.registerFunction({
    name: "gen_random_uuid",
    returns: "uuid" as any,
    impure: true, // must generate a fresh value per row, not be cached/simplified
    implementation: () => crypto.randomUUID(),
  });
  const migrationsDir = path.join(__dirname, "../../../supabase/migrations");
  const migrationFiles = fs.readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort();
  for (const file of migrationFiles) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf-8");
    db.public.none(sql);
  }
  return db;
}

describe("schema", () => {
  let db: ReturnType<typeof newDb>;

  beforeAll(() => {
    db = loadTestDb();
  });

  it("creates all 8 tables", () => {
    const tables = db.public.many(
      "select table_name from information_schema.tables where table_schema = 'public' order by table_name"
    );
    const names = tables.map((t: any) => t.table_name);
    expect(names).toEqual([
      "busquedas",
      "consultas",
      "contactos",
      "conversaciones",
      "leads_pendientes",
      "muestras",
      "ofertas",
      "propiedades",
    ]);
  });

  it("enforces contacto tipo enum", () => {
    expect(() =>
      db.public.none(
        "insert into contactos (nombre, fuente, tipo) values ('Test', 'Instagram', 'Invalido')"
      )
    ).toThrow();
  });

  it("links propiedades to an optional contacto_propietario_id", () => {
    db.public.none(
      "insert into contactos (id, nombre, fuente, tipo) values ('11111111-1111-1111-1111-111111111111', 'Dueño', 'Referido', 'Propietario')"
    );
    // moneda is passed explicitly (rather than left NULL) because pg-mem incorrectly rejects
    // NULL against a nullable CHECK column — see the migration 0003 comment for the same
    // documented quirk.
    db.public.none(
      "insert into propiedades (direccion, tipo_propiedad, precio, moneda, contacto_propietario_id) values ('Calle Falsa 123', 'Departamento', 100000, 'USD', '11111111-1111-1111-1111-111111111111')"
    );
    const rows = db.public.many("select * from propiedades");
    expect(rows).toHaveLength(1);
    expect(rows[0].contacto_propietario_id).toBe(
      "11111111-1111-1111-1111-111111111111"
    );
  });

  it("stores newline-separated image links on propiedades (0002 migration)", () => {
    db.public.none(
      "insert into propiedades (direccion, tipo_propiedad, precio, moneda, imagenes) values ('Calle Foto 1', 'Casa', 1000, 'USD', 'https://a.com/1.jpg\nhttps://a.com/2.jpg')"
    );
    const [row] = db.public.many(
      "select imagenes from propiedades where direccion = 'Calle Foto 1'"
    );
    expect(row.imagenes).toContain("https://a.com/1.jpg");
    expect(row.imagenes).toContain("https://a.com/2.jpg");
  });

  it("supports Fase 2 fields on propiedades/busquedas/contactos and leads_pendientes (0003 migration)", async () => {
    const db = createTestPool();

    const contacto = await db.query(
      `insert into contactos (nombre, tipo, fuente) values ('Test Fase2', 'Comprador', 'Otro') returning id`
    );
    const contactoId = contacto.rows[0].id;

    const propiedad = await db.query(
      `insert into propiedades (direccion, tipo_propiedad, moneda, codigo, dormitorios)
       values ('Test 123', 'PH', 'USD', 'COD-TEST', 2) returning *`
    );
    expect(propiedad.rows[0].moneda).toBe("USD");
    expect(propiedad.rows[0].codigo).toBe("COD-TEST");
    expect(propiedad.rows[0].dormitorios).toBe(2);

    const busqueda = await db.query(
      `insert into busquedas (contacto_id, tipo_operacion, presupuesto_min, presupuesto_max, moneda, tipo_propiedad)
       values ($1, 'Compra', 50000, 80000, 'USD', 'PH') returning *`,
      [contactoId]
    );
    expect(Number(busqueda.rows[0].presupuesto_min)).toBe(50000);
    expect(busqueda.rows[0].documento_aprobado).toBe(false);
    expect(busqueda.rows[0].documento_enviado).toBe(false);

    await db.query("update contactos set whatsapp_confirmado = true where id = $1", [
      contactoId,
    ]);
    const confirmado = await db.query("select whatsapp_confirmado from contactos where id = $1", [
      contactoId,
    ]);
    expect(confirmado.rows[0].whatsapp_confirmado).toBe(true);

    const consulta = await db.query(
      `insert into consultas (propiedad_id, contacto_id, canal, origen)
       values ($1, $2, 'Instagram', 'formulario_cliente') returning *`,
      [propiedad.rows[0].id, contactoId]
    );
    expect(consulta.rows[0].origen).toBe("formulario_cliente");

    const lead = await db.query(
      `insert into leads_pendientes (token, canal, psid, codigo_propiedad)
       values ('tok-123', 'Instagram', 'psid-abc', 'COD-TEST') returning *`
    );
    expect(lead.rows[0].usado).toBe(false);

    await db.end();
  });
});
