import type { Pool } from "pg";

export type Repository<T extends { id: string }> = {
  list(where?: Partial<T>): Promise<T[]>;
  findById(id: string): Promise<T | null>;
  create(data: Omit<T, "id">): Promise<T>;
  update(id: string, patch: Partial<Omit<T, "id">>): Promise<T | null>;
};

function buildWhereClause(where?: Record<string, unknown>) {
  if (!where || Object.keys(where).length === 0) {
    return { clause: "", values: [] as unknown[] };
  }
  const keys = Object.keys(where);
  const clause =
    "where " + keys.map((key, i) => `"${key}" = $${i + 1}`).join(" and ");
  return { clause, values: keys.map((key) => where[key]) };
}

export function createRepository<T extends { id: string }>(
  pool: Pool,
  tableName: string
): Repository<T> {
  return {
    async list(where) {
      const { clause, values } = buildWhereClause(where as Record<string, unknown>);
      const result = await pool.query(
        `select * from "${tableName}" ${clause} order by created_at desc`,
        values
      );
      return result.rows;
    },

    async findById(id) {
      const result = await pool.query(
        `select * from "${tableName}" where id = $1`,
        [id]
      );
      return result.rows[0] ?? null;
    },

    async create(data) {
      const keys = Object.keys(data as Record<string, unknown>);
      const values = keys.map((key) => (data as Record<string, unknown>)[key]);
      const columns = keys.map((key) => `"${key}"`).join(", ");
      const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");
      const result = await pool.query(
        `insert into "${tableName}" (${columns}) values (${placeholders}) returning *`,
        values
      );
      return result.rows[0];
    },

    async update(id, patch) {
      const keys = Object.keys(patch as Record<string, unknown>);
      if (keys.length === 0) return this.findById(id);
      const values = keys.map((key) => (patch as Record<string, unknown>)[key]);
      const setClause = keys
        .map((key, i) => `"${key}" = $${i + 2}`)
        .join(", ");
      const result = await pool.query(
        `update "${tableName}" set ${setClause} where id = $1 returning *`,
        [id, ...values]
      );
      return result.rows[0] ?? null;
    },
  };
}
