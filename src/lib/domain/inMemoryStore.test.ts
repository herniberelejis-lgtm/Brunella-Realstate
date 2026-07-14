import { describe, it, expect } from "vitest";
import { createInMemoryTable } from "./inMemoryStore";

type Row = { id: string; nombre: string };

describe("createInMemoryTable", () => {
  it("creates and finds a row by id", async () => {
    const table = createInMemoryTable<Row>();
    const created = await table.create({ nombre: "Ana" });
    expect(created.id).toBeDefined();

    const found = await table.findById(created.id);
    expect(found?.nombre).toBe("Ana");
  });

  it("returns null when finding a nonexistent id", async () => {
    const table = createInMemoryTable<Row>();
    expect(await table.findById("nope")).toBeNull();
  });

  it("updates a row and returns the updated version", async () => {
    const table = createInMemoryTable<Row>();
    const created = await table.create({ nombre: "Ana" });
    const updated = await table.update(created.id, { nombre: "Ana Actualizada" });
    expect(updated?.nombre).toBe("Ana Actualizada");
  });

  it("returns null when updating a nonexistent id", async () => {
    const table = createInMemoryTable<Row>();
    expect(await table.update("nope", { nombre: "X" })).toBeNull();
  });

  it("lists rows filtered by a partial match", async () => {
    const table = createInMemoryTable<Row>([{ id: "1", nombre: "Ana" }]);
    await table.create({ nombre: "Beto" });
    expect(await table.list({ nombre: "Ana" })).toHaveLength(1);
  });
});
