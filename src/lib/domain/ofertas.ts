import type { Pool } from "pg";
import { createRepository } from "../db/repository";

export type Oferta = {
  id: string;
  propiedad_id: string;
  contacto_id: string;
  monto: number;
  fecha: string;
  estado: "Pendiente" | "Aceptada" | "Rechazada";
  origen: "nota_de_voz" | "manual";
  created_at: string;
};

export function createOfertasModule(pool: Pool) {
  const repo = createRepository<Oferta>(pool, "ofertas");
  return {
    ...repo,
    async findByContactoId(contactoId: string): Promise<Oferta[]> {
      return repo.list({ contacto_id: contactoId } as Partial<Oferta>);
    },
    async findByPropiedadId(propiedadId: string): Promise<Oferta[]> {
      return repo.list({ propiedad_id: propiedadId } as Partial<Oferta>);
    },
  };
}
