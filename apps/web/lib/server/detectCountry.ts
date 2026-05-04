import { headers } from "next/headers";

/**
 * Best-effort guess of the user's country code (ISO 3166-1 alpha-2).
 * Order:
 *  1. Cloudflare's `cf-ipcountry` header (when behind CF — not us today)
 *  2. Fly's `fly-region` (data-centre, not the user) — only as a last
 *     resort for Asia/Pacific because most of our traffic terminates
 *     in `sin`
 *  3. The first language in `accept-language` (matches "th-TH", "en-US" …)
 *  4. "TH" as a default — METU is a Thai marketplace
 * The result is only used to pre-select the country dropdown; the
 * user can change it before submitting.
 */
export function detectDefaultCountry(): string {
  const h = headers();
  const cfCountry = h.get("cf-ipcountry");
  if (cfCountry && /^[A-Z]{2}$/.test(cfCountry)) return cfCountry;

  const lang = h.get("accept-language") ?? "";
  const tag = lang.split(",")[0]?.trim() ?? "";
  // "th-TH" → "TH", "en-GB" → "GB"
  const region = tag.split("-")[1]?.toUpperCase();
  if (region && /^[A-Z]{2}$/.test(region)) return region;

  // "th" → "TH", "ja" → "JP", "ko" → "KR" (rough mapping for a couple
  // of common cases without pulling in an entire library)
  const primary = tag.split("-")[0]?.toLowerCase();
  if (primary === "th") return "TH";
  if (primary === "ja") return "JP";
  if (primary === "ko") return "KR";
  if (primary === "vi") return "VN";

  return "TH";
}
