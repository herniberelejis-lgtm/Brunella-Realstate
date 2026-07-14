import { describe, it, expect, beforeAll } from "vitest";
import { newDb } from "pg-mem";
import fs from "node:fs";
import path from "node:path";

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

  it("creates all 7 tables", () => {
    const tables = db.public.many(
      "select table_name from information_schema.tables where table_schema = 'public' order by table_name"
    );
    const names = tables.map((t: any) => t.table_name);
    expect(names).toEqual([
      "busquedas",
      "consultas",
      "contactos",
      "conversaciones",
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
    db.public.none(
      "insert into propiedades (direccion, tipo_propiedad, precio, contacto_propietario_id) values ('Calle Falsa 123', 'Departamento', 100000, '11111111-1111-1111-1111-111111111111')"
    );
    const rows = db.public.many("select * from propiedades");
    expect(rows).toHaveLength(1);
    expect(rows[0].contacto_propietario_id).toBe(
      "11111111-1111-1111-1111-111111111111"
    );
  });

  it("stores newline-separated image links on propiedades (0002 migration)", () => {
    db.public.none(
      "insert into propiedades (direccion, tipo_propiedad, precio, imagenes) values ('Calle Foto 1', 'Casa', 1000, 'https://a.com/1.jpg\nhttps://a.com/2.jpg')"
    );
    const [row] = db.public.many(
      "select imagenes from propiedades where direccion = 'Calle Foto 1'"
    );
    expect(row.imagenes).toContain("https://a.com/1.jpg");
    expect(row.imagenes).toContain("https://a.com/2.jpg");
  });
});
