const SUFFIX_LENGTH = 8;
const MIN_MATCH_LENGTH = 6;

/**
 * Argentine mobile numbers show up in wildly different shapes depending on where they came
 * from: a client typing "351 555-1234" into the web form, vs. WhatsApp's `from` field on the
 * same number as the full international "5493515551234" (country code + mobile "9" marker +
 * area code + subscriber number). Comparing full normalized strings essentially never matches
 * across those two shapes. The subscriber number itself (the last several digits) stays the
 * same across all of them, so matching on that suffix is the practical way to recognize "this
 * is the same phone" regardless of which format it arrived in.
 */
export function phoneMatches(a: string | null | undefined, b: string): boolean {
  if (!a) return false;
  const suffixA = normalizedSuffix(a);
  const suffixB = normalizedSuffix(b);
  if (suffixA.length < MIN_MATCH_LENGTH || suffixB.length < MIN_MATCH_LENGTH) return false;
  return suffixA === suffixB;
}

function normalizedSuffix(telefono: string): string {
  return telefono.replace(/\D/g, "").slice(-SUFFIX_LENGTH);
}
