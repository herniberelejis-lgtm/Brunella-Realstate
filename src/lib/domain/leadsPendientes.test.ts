import { describe, it, expect, beforeEach } from "vitest";
import { createTestPool } from "../db/testDb";
import { createLeadsPendientesModule } from "./leadsPendientes";
import type { Pool } from "pg";

describe("leadsPendientesModule", () => {
  let pool: Pool;

  beforeEach(() => {
    pool = createTestPool();
  });

  it("creates and finds a lead by token", async () => {
    const mod = createLeadsPendientesModule(pool);

    const created = await mod.create({
      token: "tok-abc",
      canal: "Instagram",
      psid: "psid-123",
      codigo_propiedad: "COD-TEST",
      usado: false,
    } as any);

    const found = await mod.findByToken("tok-abc");
    expect(found?.psid).toBe("psid-123");
    expect(found?.codigo_propiedad).toBe("COD-TEST");
    expect(found?.id).toBe(created.id);
  });

  it("returns null for an unknown token", async () => {
    const mod = createLeadsPendientesModule(pool);
    const found = await mod.findByToken("nope");
    expect(found).toBeNull();
  });

  it("marks a lead as used", async () => {
    const mod = createLeadsPendientesModule(pool);
    const created = await mod.create({
      token: "tok-xyz",
      canal: "Facebook",
      psid: "psid-999",
      codigo_propiedad: null,
      usado: false,
    } as any);

    await mod.marcarUsado(created.id);

    const found = await mod.findByToken("tok-xyz");
    expect(found?.usado).toBe(true);
  });
});
