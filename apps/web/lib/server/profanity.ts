/**
 * Server-side profanity guard.
 *
 * Phase 11 run #2 / F3 (CEO Decision 1) — wraps `leo-profanity` so the
 * register + profile-edit flows can refuse usernames / display names
 * that contain slurs. The library ships an English dictionary (~1500
 * words). We extend it with:
 *
 *   1. A short custom blocklist of slurs the library misses or
 *      l33t-spells around (leo-profanity matches whole words only).
 *   2. A few transliterated Thai slurs — leo-profanity has no Thai
 *      dictionary on npm so we ship the most-flagged ones inline.
 *
 * The check is intentionally cheap: we lower-case the input, strip
 * spaces / punctuation that bury a slur ("nig ger", "n.i.g.g.e.r"),
 * then run `check()`. False positives are acceptable for a moderation
 * gate — the user can pick a different name. A future iteration can
 * tighten the matcher with a proper word-boundary regex.
 *
 * The dictionary is only loaded once per Node process (Next caches the
 * module). No I/O at request time.
 */
import filter from "leo-profanity";

// Slurs the default English dictionary doesn't catch (variants /
// transliterations from F3's offending Phase-10 username plus a small
// hand-picked extension). Keep this list short and obvious — a longer
// list creeps into "let's police every word" territory which isn't the
// goal here.
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
