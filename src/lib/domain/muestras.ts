import type { Pool } from "pg";
import { createRepository } from "../db/repository";

export type Muestra = {
  id: string;
  contacto_id: string;
  propiedad_id: string | null;
  propiedad_mostrada_texto: string | null;
  fecha: string;
  feedback: string | null;
  interes_resultante: "Le interesó" | "No le interesó" | "Indeciso" | null;
  created_at: string;
};

export function createMuestrasModule(pool: Pool) {
  const repo = createRepository<Muestra>(pool, "muestras");
  return {
    ...repo,
    async findByContactoId(contactoId: string): Promise<Muestra[]> {
      return repo.list({ contacto_id: contactoId } as Partial<Muestra>);
    },
    async findByPropiedadId(propiedadId: string): Promise<Muestra[]> {
      return repo.list({ propiedad_id: propiedadId } as Partial<Muestra>);
    },
  };
}
