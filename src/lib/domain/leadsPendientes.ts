import type { Pool } from "pg";
import { createRepository } from "../db/repository";

export type LeadPendiente = {
  id: string;
  token: string;
  canal: "Instagram" | "Facebook";
  psid: string;
  codigo_propiedad: string | null;
  usado: boolean;
  created_at: string;
};

export function createLeadsPendientesModule(pool: Pool) {
  const repo = createRepository<LeadPendiente>(pool, "leads_pendientes");
  return {
    ...repo,
    async findByToken(token: string): Promise<LeadPendiente | null> {
      const result = await pool.query(
        "select * from leads_pendientes where token = $1",
        [token]
      );
      return result.rows[0] ?? null;
    },
    async marcarUsado(id: string): Promise<void> {
      await pool.query("update leads_pendientes set usado = true where id = $1", [id]);
    },
  };
}
