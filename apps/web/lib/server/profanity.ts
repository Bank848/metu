/**
 * Server-side profanity guard. Wraps `leo-profanity` (English) and adds
 * a short custom blocklist plus inline Thai slurs (leo-profanity has no
 * Thai dictionary). Lower-cases + strips punctuation/spaces before
 * `check()` so common spacing tricks ("nig ger", "n.i.g.g.e.r") still trip.
 */
import filter from "leo-profanity";

// Slurs the default dictionary doesn't catch — keep it short.
const CUSTOM_BLOCKLIST = [
  "niigga",
  "niggas",
  "niglet",
  "kike",
  "chink",
  "spic",
  "tranny",
  "retard",
];

// Thai-script + romanised Thai slurs leo-profanity doesn't cover. The
// list is intentionally tiny — it catches the obvious cases without
// pretending to be a full Thai filter.
const CUSTOM_THAI = [
  "ควย",
  "เหี้ย",
  "สัส",
  "เย็ด",
  "kuay",
  "hia",
  "sus",
];

let initialised = false;
function ensureInit() {
  if (initialised) return;
  filter.add(CUSTOM_BLOCKLIST);
  filter.add(CUSTOM_THAI);
  initialised = true;
}

/**
 * Strip word-splitting tricks ("n.i.g.g.e.r", "n i g g e r", "n_i_g")
 * before passing to the dictionary check. We keep alphanumerics +
 * non-Latin script characters; everything else gets dropped.
 */
function normalise(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKC")
    // Strip ASCII punctuation + whitespace; keep word chars + non-ASCII
    // (so Thai script survives the pass).
    .replace(/[\s\p{P}\p{S}]+/gu, " ")
    .trim();
}

/** Returns true if the (normalised) text contains a flagged word. */
export function containsProfanity(text: string | null | undefined): boolean {
  if (!text) return false;
  ensureInit();
  const normal = normalise(text);
  if (filter.check(normal)) return true;
  // Also check the de-spaced form so "khanatip niigga" still trips
  // even after `normalise()` collapses the gap. leo-profanity matches
  // whole words split on whitespace, so we run a second pass without
  // spaces to catch concatenated tokens.
  const compact = normal.replace(/\s+/g, "");
  if (compact && filter.check(compact)) return true;
  // Substring sweep over the custom list to catch concatenations the
  // built-in word-boundary check misses (e.g. "khanatipniigga").
  for (const word of CUSTOM_BLOCKLIST) {
    if (compact.includes(word)) return true;
  }
  for (const word of CUSTOM_THAI) {
    if (compact.includes(word)) return true;
  }
  return false;
}

/** Censor profanity in `text` using `*` characters (passthrough helper). */
export function clean(text: string): string {
  ensureInit();
  return filter.clean(text);
}

/**
 * Convenience: returns a friendly error message when any of the supplied
 * fields contain profanity, or `null` when everything is clean. Caller
 * decides how to surface it (HTTP 400 body, form error, etc).
 */
export function findFirstProfaneField(
  fields: Record<string, string | null | undefined>,
): { field: string; message: string } | null {
  for (const [field, value] of Object.entries(fields)) {
    if (containsProfanity(value)) {
      return {
        field,
        message:
          "That word isn't allowed here — please pick something else.",
      };
    }
  }
  return null;
}
