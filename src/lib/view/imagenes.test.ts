import { describe, it, expect } from "vitest";
import { parseImagenes } from "./imagenes";

describe("parseImagenes", () => {
  it("splits newline-separated URLs into a clean array", () => {
    const result = parseImagenes("https://a.com/1.jpg\nhttps://a.com/2.jpg");
    expect(result).toEqual(["https://a.com/1.jpg", "https://a.com/2.jpg"]);
  });

  it("trims whitespace and drops blank lines", () => {
    const result = parseImagenes("  https://a.com/1.jpg  \n\n\nhttps://a.com/2.jpg\n");
    expect(result).toEqual(["https://a.com/1.jpg", "https://a.com/2.jpg"]);
  });

  it("returns an empty array for null or empty input", () => {
    expect(parseImagenes(null)).toEqual([]);
    expect(parseImagenes("")).toEqual([]);
    expect(parseImagenes("   ")).toEqual([]);
  });
});
