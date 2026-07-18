import { describe, it, expect } from "vitest";
import { phoneMatches } from "./phone";

describe("phoneMatches", () => {
  it("matches a WhatsApp international number against the same number typed locally", () => {
    expect(phoneMatches("351 555-1234", "5493515551234")).toBe(true);
  });

  it("matches regardless of spaces, dashes, or a leading +", () => {
    expect(phoneMatches("+54 351 555-1234", "0351 555-1234")).toBe(true);
  });

  it("does not match different numbers", () => {
    expect(phoneMatches("351 555-1234", "5493515559999")).toBe(false);
  });

  it("returns false when the stored phone is null", () => {
    expect(phoneMatches(null, "5493515551234")).toBe(false);
  });

  it("does not match on short/garbage input to avoid false positives", () => {
    expect(phoneMatches("123", "123")).toBe(false);
  });
});
