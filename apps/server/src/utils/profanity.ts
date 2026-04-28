/**
 * Server-side profanity guard. Mirrors apps/web/lib/server/profanity.ts
 * 1:1 — kept BFF-side until Phase 13.2 ports auth here, now lives
 * server-side so register / change-name flows reject slurs before
 * touching the DB (saves Neon round-trips on bot floods + matches
 * the Phase 11 / F3 contract that the same dictionary applies on
 * every write path).
 */
import filter from "leo-profanity";

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

const CUSTOM_THAI = ["ควย", "เหี้ย", "สัส", "เย็ด", "kuay", "hia", "sus"];

let initialised = false;
function ensureInit() {
  if (initialised) return;
  filter.add(CUSTOM_BLOCKLIST);
  filter.add(CUSTOM_THAI);
  initialised = true;
}

function normalise(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[\s\p{P}\p{S}]+/gu, " ")
    .trim();
}

export function containsProfanity(text: string | null | undefined): boolean {
  if (!text) return false;
  ensureInit();
  const normal = normalise(text);
  if (filter.check(normal)) return true;
  const compact = normal.replace(/\s+/g, "");
  if (compact && filter.check(compact)) return true;
  for (const word of CUSTOM_BLOCKLIST) if (compact.includes(word)) return true;
  for (const word of CUSTOM_THAI) if (compact.includes(word)) return true;
  return false;
}

export function findFirstProfaneField(
  fields: Record<string, string | null | undefined>,
): { field: string; message: string } | null {
  for (const [field, value] of Object.entries(fields)) {
    if (containsProfanity(value)) {
      return {
        field,
        message: "That word isn't allowed here — please pick something else.",
      };
    }
  }
  return null;
}
