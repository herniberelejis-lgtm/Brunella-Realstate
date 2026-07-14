import { describe, it, expect, vi, afterEach } from "vitest";

describe("getPool", () => {
  const original = process.env.DATABASE_URL;

  afterEach(() => {
    process.env.DATABASE_URL = original;
  });

  it("throws when DATABASE_URL is not set", async () => {
    delete process.env.DATABASE_URL;
    vi.resetModules();
    const { getPool } = await import("./pool");
    expect(() => getPool()).toThrow(/DATABASE_URL is not set/);
  });

  it("returns the same Pool instance across calls once DATABASE_URL is set", async () => {
    process.env.DATABASE_URL = "postgres://user:pass@localhost:5432/test";
    vi.resetModules();
    const { getPool } = await import("./pool");
    const first = getPool();
    const second = getPool();
    expect(first).toBe(second);
  });
});
