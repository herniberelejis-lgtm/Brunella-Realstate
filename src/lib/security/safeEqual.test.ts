import { describe, it, expect } from "vitest";
import { safeEqual } from "./safeEqual";

describe("safeEqual", () => {
  it("returns true for identical strings", () => {
    expect(safeEqual("secret123", "secret123")).toBe(true);
  });

  it("returns false for different strings of the same length", () => {
    expect(safeEqual("secret123", "secret456")).toBe(false);
  });

  it("returns false for different-length strings without throwing", () => {
    expect(safeEqual("short", "muchlongervalue")).toBe(false);
  });

  it("returns false when either value is empty", () => {
    expect(safeEqual("", "secret")).toBe(false);
    expect(safeEqual("secret", "")).toBe(false);
  });
});
