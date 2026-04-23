/**
 * Pure cart-math helpers — extracted from `app/cart/CartLines.tsx` so
 * they can be unit-tested without React, jsdom, or any Prisma mocks.
 *
 * The CartLines component re-imports these and wires them into its
 * useMemo selectors; the math itself stays a one-line function call.
 *
 * Keep these functions pure (no I/O, no React, no globals). If you
 * find yourself reaching for `useState`, the helper belongs in the
 * component, not here.
 */

export const DIGITAL_DELIVERY_METHODS = new Set([
  "download",
  "email",
  "license_key",
  "streaming",
]);

/** Minimum shape needed for the math — accepts any superset of these fields. */
export type CartLineForMath = {
  cartItemId: number;
  storeId: number;
  deliveryMethod: string;
  quantity: number;
  /** Per-unit price after the seller's own product-level discount. */
  unitPrice: number;
  /** Stock available (only meaningful for non-digital lines). */
  stock: number;
  /** Subtotal for this line — equals `unitPrice * quantity`. */
  lineTotal: number;
};

/**
 * Maximum quantity allowed for a single line.
 *  - Digital deliveries are capped at 1 per order (the buyer is buying
 *    a license / file, not stockable inventory).
 *  - Physical / service lines cap at the visible stock; we floor at 1
 *    so the qty stepper never disables the line entirely just because
 *    we got a stale stock=0 read.
 */
export function maxForLine(line: Pick<CartLineForMath, "deliveryMethod" | "stock">): number {
  if (DIGITAL_DELIVERY_METHODS.has(line.deliveryMethod)) return 1;
  return Math.max(1, line.stock);
}

/**
 * Sum the `lineTotal` of every line in the input. Used both for the
 * "Subtotal" row in the cart summary and as the input to the coupon
 * eligibility filter.
 */
export function subtotalOf(lines: ReadonlyArray<Pick<CartLineForMath, "lineTotal">>): number {
  return lines.reduce((acc, l) => acc + l.lineTotal, 0);
}

/**
 * Subtotal of just the lines from `storeId` — coupons are scoped to
 * the store that issued them, so a code from "Store A" only discounts
 * Store A's lines even when other lines are in the cart.
 */
export function eligibleSubtotalForStore(
  lines: ReadonlyArray<Pick<CartLineForMath, "storeId" | "lineTotal">>,
  storeId: number,
): number {
  return lines
    .filter((l) => l.storeId === storeId)
    .reduce((acc, l) => acc + l.lineTotal, 0);
}

export type CouponDiscount = {
  discountType: "percent" | "fixed";
  /** For "percent" this is 0–100; for "fixed" it's a currency amount. */
  discountValue: number;
};

/**
 * Compute the discount amount a coupon applies to an eligible subtotal.
 *
 *   - "percent"  → `eligibleSubtotal * (value / 100)`
 *   - "fixed"    → `min(eligibleSubtotal, value)` so we never refund
 *                  more than the buyer is paying for the eligible lines.
 *
 * Returns 0 for non-positive eligible subtotals (e.g. when the buyer
 * deselects the only line that would have qualified for the coupon).
 */
export function discountFromCoupon(
  eligibleSubtotal: number,
  coupon: CouponDiscount,
): number {
  if (eligibleSubtotal <= 0) return 0;
  if (coupon.discountType === "percent") {
    return (eligibleSubtotal * coupon.discountValue) / 100;
  }
  return Math.min(eligibleSubtotal, coupon.discountValue);
}

/**
 * Final cart total — `max(0, subtotal − discount)` so a "fixed"
 * coupon worth more than the eligible subtotal still produces a
 * non-negative total. Defensive in case any of the other helpers
 * ever returns a negative value.
 */
export function cartTotal(subtotal: number, discount: number): number {
  return Math.max(0, subtotal - discount);
}
