import { describe, it, expect, beforeEach } from "vitest";
import { createHmac } from "node:crypto";
import { verifyChallenge, verifySignature } from "./webhookVerification";

describe("verifyChallenge", () => {
  beforeEach(() => {
    process.env.META_VERIFY_TOKEN = "test-verify-token";
  });

  it("returns the challenge when mode and token match", () => {
    const result = verifyChallenge("subscribe", "test-verify-token", "challenge-123");
    expect(result).toBe("challenge-123");
  });

  it("returns null when the token does not match", () => {
    const result = verifyChallenge("subscribe", "wrong-token", "challenge-123");
    expect(result).toBeNull();
  });

  it("returns null when mode is not subscribe", () => {
    const result = verifyChallenge("unsubscribe", "test-verify-token", "challenge-123");
    expect(result).toBeNull();
  });
});

describe("verifySignature", () => {
  beforeEach(() => {
    process.env.META_APP_SECRET = "test-app-secret";
  });

  it("accepts a signature computed with the configured app secret", () => {
    const rawBody = '{"object":"page","entry":[]}';
    const expected =
      "sha256=" + createHmac("sha256", "test-app-secret").update(rawBody).digest("hex");
    expect(verifySignature(rawBody, expected)).toBe(true);
  });

  it("rejects a signature computed with the wrong secret", () => {
    const rawBody = '{"object":"page","entry":[]}';
    const wrong = "sha256=" + createHmac("sha256", "not-the-secret").update(rawBody).digest("hex");
    expect(verifySignature(rawBody, wrong)).toBe(false);
  });

  it("rejects a missing signature header", () => {
    expect(verifySignature('{"object":"page"}', undefined)).toBe(false);
  });
});
