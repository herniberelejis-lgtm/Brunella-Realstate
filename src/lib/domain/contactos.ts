import type { Pool } from "pg";
import { createRepository } from "../db/repository";
import { normalizeText } from "../text/normalize";

export type Contacto = {
  id: string;
  nombre: string;
  telefono: string | null;
  email: string | null;
  fuente: "Instagram" | "Facebook" | "Zonaprop" | "Grupo Banker" | "Referido" | "Otro";
  fecha_primer_contacto: string;
  tipo: "Comprador" | "Propietario" | "Ambos";
  etapa:
    | "Nuevo"
    | "Calificando"
    | "Buscando"
    | "Mostrando propiedades"
    | "Negociando"
    | "Cerrado-ganado"
    | "Cerrado-perdido"
    | "Inactivo";
  temperatura: "Frio" | "Tibio" | "Caliente";
  ultima_actividad: string;
  created_at: string;
};

export function createContactosModule(pool: Pool) {
  const repo = createRepository<Contacto>(pool, "contactos");

  return {
    ...repo,

    async findByNombreLike(nombre: string): Promise<Contacto[]> {
      // Accent-insensitive: Whisper transcribes spoken audio, which carries no written
      // accents, so "maria" must still match "María Gómez". Filtering in JS (rather than
      // SQL ILIKE, which is accent-sensitive) keeps this correct without a DB extension.
      const todos = await this.list();
      const normalizedQuery = normalizeText(nombre);
      return todos.filter((c) => normalizeText(c.nombre).includes(normalizedQuery));
    },

    async findNecesitanSeguimiento(diasSinActividad: number): Promise<Contacto[]> {
      const result = await pool.query(
        `select * from contactos
         where etapa not in ('Cerrado-ganado', 'Cerrado-perdido', 'Inactivo')
         and ultima_actividad < now() - ($1 || ' days')::interval
         order by ultima_actividad asc`,
        [diasSinActividad]
      );
      return result.rows;
    },

    async marcarActividad(contactoId: string): Promise<void> {
      await pool.query(
        "update contactos set ultima_actividad = now() where id = $1",
        [contactoId]
      );
    },
  };
}
