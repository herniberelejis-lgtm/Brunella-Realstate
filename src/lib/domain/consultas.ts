import type { Pool } from "pg";
import { createRepository } from "../db/repository";

export type Consulta = {
  id: string;
  propiedad_id: string;
  contacto_id: string | null;
  fecha: string;
  canal: "Instagram" | "Facebook" | "WhatsApp" | "Zonaprop" | "Grupo Banker" | "Otro";
  origen: "nota_de_voz" | "manual";
  created_at: string;
};

export function createConsultasModule(pool: Pool) {
  const repo = createRepository<Consulta>(pool, "consultas");
  return {
    ...repo,
    async findByContactoId(contactoId: string): Promise<Consulta[]> {
      return repo.list({ contacto_id: contactoId } as Partial<Consulta>);
    },
    async findByPropiedadId(propiedadId: string): Promise<Consulta[]> {
      return repo.list({ propiedad_id: propiedadId } as Partial<Consulta>);
    },
  };
}
