import type { Pool } from "pg";
import { createRepository } from "../db/repository";

export type Busqueda = {
  id: string;
  contacto_id: string;
  tipo_operacion: "Compra" | "Alquiler" | "Inversion";
  presupuesto_min: number | null;
  presupuesto_max: number | null;
  moneda: "ARS" | "USD" | null;
  zona: string | null;
  tipo_propiedad: "Departamento" | "Casa" | "PH" | "Lote" | "Local/Oficina" | null;
  dormitorios: number | null;
  otros_requisitos: string | null;
  activa: boolean;
  documento_aprobado: boolean;
  documento_enviado: boolean;
  created_at: string;
};

export function createBusquedasModule(pool: Pool) {
  const repo = createRepository<Busqueda>(pool, "busquedas");
  return {
    ...repo,
    async findByContactoId(contactoId: string): Promise<Busqueda[]> {
      return repo.list({ contacto_id: contactoId } as Partial<Busqueda>);
    },
    async findPendienteAprobadoByContactoId(contactoId: string): Promise<Busqueda | null> {
      const result = await pool.query(
        `select * from busquedas
         where contacto_id = $1 and documento_aprobado = true and documento_enviado = false
         order by created_at desc limit 1`,
        [contactoId]
      );
      return result.rows[0] ?? null;
    },
  };
}
