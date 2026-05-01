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
 * Compact baht: "฿45.6K", "฿1.2M". Falls back to money() under ฿1,000.
 * en-US locale keeps the K/M/B suffix universal.
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
 * Coin shims around money(): coins() returns baht (or "Free" at 0),
 * thbToCoins() is now passthrough. Kept as shims so existing call-sites
 * don't need a sweep.
 */
export function coins(n: number | string | null | undefined): string {
  const num = typeof n === "string" ? Number(n) : (n ?? 0);
  if (!Number.isFinite(num)) return money(0);
  if (num === 0) return "Free";
  return money(num);
}

export function coinsCompact(n: number | string | null | undefined): string {
  return moneyCompact(n);
}

export function thbToCoins(thb: number | string | null | undefined): number {
  const num = typeof thb === "string" ? Number(thb) : (thb ?? 0);
  if (!Number.isFinite(num)) return 0;
  return num;
}
