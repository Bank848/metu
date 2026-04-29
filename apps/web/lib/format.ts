/**
 * Format a number as Thai baht.
 * money(665) → "฿665"
 * money(1234.5) → "฿1,235"
 */
export function money(n: number | string | null | undefined): string {
  const num = typeof n === "string" ? Number(n) : (n ?? 0);
  if (!Number.isFinite(num)) return "฿0";
  return new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: 0,
  }).format(num);
}

/**
 * Format a plain integer with thousands separators.
 */
export function count(n: number | string | null | undefined): string {
  const num = typeof n === "string" ? Number(n) : (n ?? 0);
  if (!Number.isFinite(num)) return "0";
  return new Intl.NumberFormat("en-US").format(num);
}

/**
 * Format baht with K/M/B abbreviation for compact slots (KPI cards).
 *
 * Phase 11.2 — `money()` produces "฿1,234,567" which overflows the
 * highlight StatCard slot at the seller / admin dashboards. The
 * compact form ("฿45.6K", "฿1.2M") fits the headline number into the
 * slot without truncation. Below ฿1,000 we fall through to the full
 * format because abbreviating "฿665" → "฿665" would just confuse the
 * reader (no compaction happens).
 *
 * Examples:
 *   moneyCompact(665)      → "฿665"
 *   moneyCompact(45623)    → "฿45.6K"
 *   moneyCompact(1234567)  → "฿1.2M"
 *   moneyCompact(1.5e9)    → "฿1.5B"
 *
 * Locale note: we use `en-US` for the compact half so the suffix is
 * the universal K/M/B (Thai locale would emit พ/ล which adds
 * cognitive load for the bilingual seller dashboard). The currency
 * symbol stays "฿" via manual prefix to avoid Intl injecting "THB".
 */
export function moneyCompact(n: number | string | null | undefined): string {
  const num = typeof n === "string" ? Number(n) : (n ?? 0);
  if (!Number.isFinite(num)) return "฿0";
  if (Math.abs(num) < 1000) return money(num);
  const compact = new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(num);
  return `฿${compact}`;
}

/**
 * Phase 17.2 — coin formatter. The buyer-facing currency since the
 * 1 ฿ → 10 coins migration. We deliberately spell out "coins" rather
 * than using a symbol — there's no Unicode glyph that reads as
 * "in-app token", and a plain word avoids the "is that ฿ or M?"
 * ambiguity at small font sizes.
 *
 * coins(1234) → "1,234 coins"
 * coins(1)    → "1 coin"
 * coins(0)    → "Free"
 *
 * Compact variant for KPI tiles: coinsCompact(45623) → "45.6K coins".
 */
export function coins(n: number | string | null | undefined): string {
  const num = typeof n === "string" ? Number(n) : (n ?? 0);
  if (!Number.isFinite(num)) return "0 coins";
  if (num === 0) return "Free";
  const formatted = new Intl.NumberFormat("en-US").format(num);
  return `${formatted} ${num === 1 ? "coin" : "coins"}`;
}

export function coinsCompact(n: number | string | null | undefined): string {
  const num = typeof n === "string" ? Number(n) : (n ?? 0);
  if (!Number.isFinite(num)) return "0 coins";
  if (num === 0) return "Free";
  if (Math.abs(num) < 1000) return coins(num);
  const compact = new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(num);
  return `${compact} coins`;
}

/**
 * Convert THB → coins for any callers that still hold a baht number
 * (e.g. legacy seller analytics that haven't migrated yet). 1 baht
 * = 10 coins; we round to integer so the ledger never carries
 * fractional coin amounts.
 */
export function thbToCoins(thb: number | string | null | undefined): number {
  const num = typeof thb === "string" ? Number(thb) : (thb ?? 0);
  if (!Number.isFinite(num)) return 0;
  return Math.round(num * 10);
}
