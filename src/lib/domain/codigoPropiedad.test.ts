import { describe, it, expect } from "vitest";
import { generateCodigoPropiedad } from "./codigoPropiedad";

describe("generateCodigoPropiedad", () => {
  it("returns a short code in the COD-XXXX format", () => {
    const codigo = generateCodigoPropiedad();
    expect(codigo).toMatch(/^COD-[A-F0-9]{4}$/);
  });

  it("returns a different code on each call", () => {
    const a = generateCodigoPropiedad();
    const b = generateCodigoPropiedad();
    expect(a).not.toBe(b);
  });
});
