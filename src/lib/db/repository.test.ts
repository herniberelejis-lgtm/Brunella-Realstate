import { describe, it, expect, beforeEach } from "vitest";
import { createTestPool } from "./testDb";
import { createRepository } from "./repository";
import type { Pool } from "pg";

type Contacto = {
  id: string;
  nombre: string;
  fuente: string;
  tipo: string;
};

describe("createRepository", () => {
  let pool: Pool;
  let repo: ReturnType<typeof createRepository<Contacto>>;

  beforeEach(() => {
    pool = createTestPool();
    repo = createRepository<Contacto>(pool, "contactos");
  });

  it("creates and finds a row by id", async () => {
    const created = await repo.create({
      nombre: "María Gómez",
      fuente: "Instagram",
      tipo: "Comprador",
    });
    expect(created.id).toBeDefined();
    expect(created.nombre).toBe("María Gómez");

    const found = await repo.findById(created.id);
    expect(found?.nombre).toBe("María Gómez");
  });

  it("lists rows filtered by an exact-match where clause", async () => {
    await repo.create({ nombre: "Juan", fuente: "Facebook", tipo: "Comprador" });
    await repo.create({ nombre: "Ana", fuente: "Facebook", tipo: "Propietario" });

    const compradores = await repo.list({ tipo: "Comprador" });
    expect(compradores).toHaveLength(1);
    expect(compradores[0].nombre).toBe("Juan");
  });

  it("updates a row without mutating the input object", async () => {
    const created = await repo.create({ nombre: "Pedro", fuente: "Otro", tipo: "Comprador" });
    const patch = { nombre: "Pedro Actualizado" };
    const updated = await repo.update(created.id, patch);

    expect(updated?.nombre).toBe("Pedro Actualizado");
    expect(patch).toEqual({ nombre: "Pedro Actualizado" }); // input untouched
  });

  it("returns null when finding a nonexistent id", async () => {
    const found = await repo.findById("00000000-0000-0000-0000-000000000000");
    expect(found).toBeNull();
  });
});
