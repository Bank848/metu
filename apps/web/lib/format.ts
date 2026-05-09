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
 * Default money formatter: always returns "฿X.XX" — including ฿0.00.
 * Use this anywhere 0 means "no money moved" (revenue, GMV, totals,
 * chart hovers). For product-price contexts where 0 means free, use
 * `coinsOrFree()`.
 */
export function coins(n: number | string | null | undefined): string {
  const num = typeof n === "string" ? Number(n) : (n ?? 0);
  if (!Number.isFinite(num)) return money(0);
  return money(num);
}

/**
 * Product-price formatter: returns "Free" when the price is 0,
 * otherwise the same "฿X.XX" as `coins()`. Use this on browse cards,
 * product detail pages, and cart-line UNIT prices — places where 0
 * genuinely means the seller is offering the product for free.
 */
export function coinsOrFree(n: number | string | null | undefined): string {
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

const TZ = "Asia/Bangkok";
const LOCALE = "en-GB";

function toDate(v: string | number | Date | null | undefined): Date | null {
  if (v == null) return null;
  const d = v instanceof Date ? v : new Date(typeof v === "number" && v < 1e12 ? v * 1000 : v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "4 May 2025" */
export function fmtDate(v: string | number | Date | null | undefined): string {
  const d = toDate(v);
  if (!d) return "—";
  return d.toLocaleDateString(LOCALE, { day: "numeric", month: "short", year: "numeric", timeZone: TZ });
}

/** "4 May 2025, 14:30" */
export function fmtDateTime(v: string | number | Date | null | undefined): string {
  const d = toDate(v);
  if (!d) return "—";
  return d.toLocaleString(LOCALE, {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: false, timeZone: TZ,
  });
}

/** "14:30" */
export function fmtTime(v: string | number | Date | null | undefined): string {
  const d = toDate(v);
  if (!d) return "—";
  return d.toLocaleTimeString(LOCALE, { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: TZ });
}

/** "4/5/2025" short date */
export function fmtDateShort(v: string | number | Date | null | undefined): string {
  const d = toDate(v);
  if (!d) return "—";
  return d.toLocaleDateString(LOCALE, { day: "numeric", month: "numeric", year: "numeric", timeZone: TZ });
}

/** "May 2025" */
export function fmtMonthYear(v: string | number | Date | null | undefined): string {
  const d = toDate(v);
  if (!d) return "—";
  return d.toLocaleDateString(LOCALE, { month: "short", year: "numeric", timeZone: TZ });
}
