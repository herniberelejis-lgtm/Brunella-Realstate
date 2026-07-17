import type { Pool } from "pg";
import { createRepository } from "../db/repository";
import { normalizeText } from "../text/normalize";

export type Propiedad = {
  id: string;
  contacto_propietario_id: string | null;
  direccion: string;
  tipo_propiedad: "Departamento" | "Casa" | "PH" | "Lote" | "Local/Oficina";
  descripcion: string | null;
  precio: number | null;
  moneda: "ARS" | "USD" | null;
  codigo: string | null;
  dormitorios: number | null;
  fecha_recibida: string;
  condiciones: string | null;
  estado: "Activa" | "Vendida" | "Retirada";
  consultas_historicas: number;
  visitas_historicas: number;
  imagenes: string | null;
  created_at: string;
};

export type PropiedadConTotales = Propiedad & {
  consultas_totales: number;
  visitas_totales: number;
};

export function createPropiedadesModule(pool: Pool) {
  const repo = createRepository<Propiedad>(pool, "propiedades");

  return {
    ...repo,

    async findByDireccionLike(direccion: string): Promise<Propiedad[]> {
      // Accent-insensitive for the same reason as findByNombreLike in contactos.ts.
      const todas = await this.list();
      const normalizedQuery = normalizeText(direccion);
      return todas.filter((p) => normalizeText(p.direccion).includes(normalizedQuery));
    },

    async findByCodigo(codigo: string): Promise<Propiedad | null> {
      const result = await pool.query("select * from propiedades where codigo = $1", [codigo]);
      return result.rows[0] ?? null;
    },

    async withTotales(propiedad: Propiedad): Promise<PropiedadConTotales> {
      const [consultasResult, muestrasResult] = await Promise.all([
        pool.query("select count(*)::int as total from consultas where propiedad_id = $1", [
          propiedad.id,
        ]),
        pool.query("select count(*)::int as total from muestras where propiedad_id = $1", [
          propiedad.id,
        ]),
      ]);
      return {
        ...propiedad,
        consultas_totales: propiedad.consultas_historicas + consultasResult.rows[0].total,
        visitas_totales: propiedad.visitas_historicas + muestrasResult.rows[0].total,
      };
    },
  };
}
