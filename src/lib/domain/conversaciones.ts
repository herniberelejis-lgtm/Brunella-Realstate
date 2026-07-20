import type { Pool } from "pg";
import { createRepository } from "../db/repository";

export type Conversacion = {
  id: string;
  contacto_id: string;
  fecha: string;
  canal: "Llamada" | "WhatsApp" | "Instagram DM" | "Presencial" | "Otro";
  resumen: string;
  proximo_paso: string | null;
  origen: "nota_de_voz" | "manual" | "importado_whatsapp";
  created_at: string;
};

export function createConversacionesModule(pool: Pool) {
  const repo = createRepository<Conversacion>(pool, "conversaciones");
  return {
    ...repo,
    async findByContactoId(contactoId: string): Promise<Conversacion[]> {
      return repo.list({ contacto_id: contactoId } as Partial<Conversacion>);
    },
    async findContactoIdsByOrigen(origen: Conversacion["origen"]): Promise<string[]> {
      const result = await pool.query(
        "select distinct contacto_id from conversaciones where origen = $1",
        [origen]
      );
      return result.rows.map((r) => r.contacto_id);
    },
  };
}
