// Time helpers anchored to Asia/Bangkok (UTC+7, no DST).
//
// Sellers / admins pick coupon dates in <input type="date"> which lands
// at UTC midnight after `z.coerce.date()`. Storing that raw produces a
// 7-hour misalignment in Bangkok: a coupon with endDate=2026-12-31
// expires at 07:00 ICT instead of 23:59:59 ICT. These helpers snap a
// Date or "YYYY-MM-DD" string to the seller-intended day boundary.

const BANGKOK_FMT = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Bangkok",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function ymdInBangkok(input: Date | string): string {
  if (typeof input === "string") {
    // ISO date or datetime — take the leading YYYY-MM-DD if present.
    const m = input.match(/^(\d{4}-\d{2}-\d{2})/);
    if (m) return m[1];
    return BANGKOK_FMT.format(new Date(input));
  }
  return BANGKOK_FMT.format(input);
}

/** Start of the given day in Bangkok local time, expressed as UTC. */
export function bangkokStartOfDay(input: Date | string): Date {
  return new Date(`${ymdInBangkok(input)}T00:00:00+07:00`);
}

/** End of the given day in Bangkok local time (23:59:59.999), expressed as UTC. */
export function bangkokEndOfDay(input: Date | string): Date {
  return new Date(`${ymdInBangkok(input)}T23:59:59.999+07:00`);
}
