import { timingSafeEqual } from "node:crypto";

/**
 * Constant-time string comparison for secrets (webhook tokens, cron bearer secrets,
 * dashboard passwords). Plain `===` short-circuits on the first differing byte, leaking
 * timing information about how many leading characters are correct.
 */
export function safeEqual(a: string, b: string): boolean {
  if (!a || !b) return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
