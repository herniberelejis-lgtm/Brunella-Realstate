import { randomBytes } from "node:crypto";

export function generateCodigoPropiedad(): string {
  const hex = randomBytes(2).toString("hex").toUpperCase();
  return `COD-${hex}`;
}
