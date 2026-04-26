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
