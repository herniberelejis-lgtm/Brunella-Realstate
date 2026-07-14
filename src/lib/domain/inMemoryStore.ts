import { randomUUID } from "node:crypto";

export function createInMemoryTable<T extends { id: string }>(initial: T[] = []) {
  let rows: T[] = [...initial];

  return {
    async list(where?: Partial<T>): Promise<T[]> {
      if (!where) return [...rows];
      return rows.filter((row) =>
        Object.entries(where).every(([key, value]) => (row as any)[key] === value)
      );
    },
    async findById(id: string): Promise<T | null> {
      return rows.find((row) => row.id === id) ?? null;
    },
    async create(data: Omit<T, "id">): Promise<T> {
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
