import type { Pool } from "pg";
import { createRepository } from "../db/repository";

export type Conversacion = {
  id: string;
  contacto_id: string;
  fecha: string;
  canal: "Llamada" | "WhatsApp" | "Instagram DM" | "Presencial" | "Otro";
  resumen: string;
  proximo_paso: string | null;
  origen: "nota_de_voz" | "manual";
  created_at: string;
};

export function createConversacionesModule(pool: Pool) {
  const repo = createRepository<Conversacion>(pool, "conversaciones");
  return {
    ...repo,
    async findByContactoId(contactoId: string): Promise<Conversacion[]> {
      return repo.list({ contacto_id: contactoId } as Partial<Conversacion>);
    },
  };
}
