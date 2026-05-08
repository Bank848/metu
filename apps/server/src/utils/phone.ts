// Thai phone normalisation. Buyers type their number in whatever
// format feels natural — "0812345678", "812345678", "66812345678",
// "+66 81 234 5678" — we normalise to E.164 ("+66812345678") for
// storage and Firebase Phone Auth.
//
// Rules:
//   • Strip whitespace, dashes, parens.
//   • If the input already starts with "+66", keep as-is.
//   • If the input starts with "66" (no plus), add the plus.
//   • If the input starts with "0", drop the leading 0 + prefix "+66".
//   • Otherwise, if it's exactly 9 digits with a leading non-zero,
//     prefix "+66".
//   • Anything else → return the cleaned string unchanged. The caller
//     will reject it via isValidThaiE164.

export function normalizeThaiPhone(input: string | null | undefined): string {
  const cleaned = String(input ?? "").replace(/[\s\-().]/g, "");
  if (!cleaned) return "";
  if (cleaned.startsWith("+66")) return cleaned;
  if (cleaned.startsWith("66") && /^\d+$/.test(cleaned)) return "+" + cleaned;
  // Strip a single optional leading "+" if present (e.g. user typed "+0812..." by accident).
  const noPlus = cleaned.replace(/^\+/, "");
  if (/^0\d{8,9}$/.test(noPlus)) return "+66" + noPlus.slice(1);
  if (/^[1-9]\d{8}$/.test(noPlus)) return "+66" + noPlus;
  return cleaned;
}

/** True iff the string is exactly +66 followed by a 9-digit Thai number. */
export function isValidThaiE164(s: string): boolean {
  return /^\+66\d{9}$/.test(s);
}

/**
 * Mask a phone number to the country prefix + last 4 digits. Use for
 * any audit_log meta payload, UI surface, or transactional email body
 * that doesn't strictly need the full E.164 — strict need is rare.
 *
 * Example: "+66812345678" → "+66 *** *** 5678".
 */
export function maskPhoneTail(phone: string | null | undefined): string {
  const cleaned = String(phone ?? "").replace(/\s+/g, "");
  if (!cleaned) return "";
  const tail = cleaned.slice(-4);
  const prefixMatch = cleaned.match(/^\+\d{1,3}/);
  const prefix = prefixMatch ? prefixMatch[0] : "";
  return `${prefix} *** *** ${tail}`.trim();
}
