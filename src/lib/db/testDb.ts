import { newDb } from "pg-mem";
import fs from "node:fs";
import path from "node:path";
import type { Pool } from "pg";

export function createTestPool(): Pool {
  const db = newDb({ autoCreateForeignKeyIndices: true });
  db.public.registerFunction({
    name: "gen_random_uuid",
    returns: "uuid" as any,
    impure: true, // must generate a fresh value per row, not be cached/simplified
    implementation: () => crypto.randomUUID(),
  });
  const sql = fs.readFileSync(
    path.join(__dirname, "../../../supabase/migrations/0001_schema.sql"),
    "utf-8"
  );
  db.public.none(sql);
  const adapter = db.adapters.createPg();
  return new adapter.Pool() as unknown as Pool;
}
