import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyChallenge(
  mode: string | null,
  token: string | null,
  challenge: string | null
): string | null {
  const expected = process.env.META_VERIFY_TOKEN;
  if (!expected || mode !== "subscribe" || token !== expected || !challenge) return null;
  return challenge;
}

export function verifySignature(
  rawBody: string,
  signatureHeader: string | null | undefined
): boolean {
  const secret = process.env.META_APP_SECRET;
  if (!secret || !signatureHeader) return false;
  const expected =
    "sha256=" + createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(signatureHeader);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
