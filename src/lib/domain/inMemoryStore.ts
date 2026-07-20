import { randomUUID } from "node:crypto";

export function createInMemoryTable<T extends { id: string }>(initial: T[] = []) {
  let rows: T[] = [...initial];

  return {
    async list(where?: Partial<T>): Promise<T[]> {
      if (!where) return [...rows];
      return rows.filter((row) =>
        Object.entries(where).every(
          ([key, value]) => (row as Record<string, unknown>)[key] === value
        )
      );
    },
    async findById(id: string): Promise<T | null> {
      return rows.find((row) => row.id === id) ?? null;
    },
    // Partial por el mismo motivo que Repository.create: los llamadores omiten columnas
    // que en Postgres tienen default. El store en memoria no aplica esos defaults.
    async create(data: Partial<Omit<T, "id">>): Promise<T> {
      const created = { ...data, id: randomUUID() } as T;
      rows = [...rows, created];
      return created;
    },
    async update(id: string, patch: Partial<Omit<T, "id">>): Promise<T | null> {
      const existing = rows.find((row) => row.id === id);
      if (!existing) return null;
      const updated = { ...existing, ...patch } as T;
      rows = rows.map((row) => (row.id === id ? updated : row));
      return updated;
    },
  };
}
