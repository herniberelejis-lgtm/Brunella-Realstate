import { describe, it, expect, afterEach } from "vitest";
import { getDomainModules } from "./factory";

describe("getDomainModules", () => {
  const originalDatabaseUrl = process.env.DATABASE_URL;

  afterEach(() => {
    process.env.DATABASE_URL = originalDatabaseUrl;
  });

  it("returns seeded in-memory data when DATABASE_URL is not set", async () => {
    delete process.env.DATABASE_URL;
    const modules = getDomainModules();
    const contactos = await modules.contactos.list();
    expect(contactos.length).toBeGreaterThan(0);
  });

  it("returns the same in-memory instance across calls in one process", () => {
    delete process.env.DATABASE_URL;
    const first = getDomainModules();
    const second = getDomainModules();
    expect(first.contactos).toBe(second.contactos);
  });
});
