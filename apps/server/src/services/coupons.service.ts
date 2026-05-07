import { prisma } from "../db/prisma.js";
import type { CouponValidateResult } from "../models/coupons.model.js";

// PENTEST-002/109: enumeration-resistant generic rejection. The four
// distinct rejection reasons used to leak whether a code existed +
// its lifecycle state, letting an attacker enumerate the coupon
// namespace at scale. Now every failure mode collapses into one
// public string. Precise reason still goes to server logs for
// support / forensic use.
const GENERIC_REJECTION = "Coupon is not valid";

/**
 * Validate a coupon code. Always returns 200 — `valid: true|false` +
 * a generic `reason` for the client to surface inline. We deliberately
 * don't `throw AppError(404)` for "not found" because the cart UI
 * shows the rejection reason next to the input rather than treating
 * it as an HTTP error.
 * Internal failure ladder (logged to server, never surfaced):
 *   1. row missing or `isActive=false` → "not_found_or_inactive"
 *   2. now < startDate                  → "not_yet_active"
 *   3. now > endDate                    → "expired"
 *   4. usage >= usageLimit              → "usage_limit_reached"
 */
export async function validateCoupon(code: string): Promise<CouponValidateResult> {
  const coupon = await prisma.coupon.findFirst({
    where: { code, isActive: true },
    include: { store: { select: { storeId: true, name: true } } },
  });
  if (!coupon) {
    // eslint-disable-next-line no-console
    console.info("[coupon.validate] reject", { code: code.slice(0, 32), reason: "not_found_or_inactive" });
    return { valid: false, reason: GENERIC_REJECTION };
  }

  const now = new Date();
  if (now < coupon.startDate) {
    // eslint-disable-next-line no-console
    console.info("[coupon.validate] reject", { code: code.slice(0, 32), reason: "not_yet_active" });
    return { valid: false, reason: GENERIC_REJECTION };
  }
  if (now > coupon.endDate) {
    // eslint-disable-next-line no-console
    console.info("[coupon.validate] reject", { code: code.slice(0, 32), reason: "expired" });
    return { valid: false, reason: GENERIC_REJECTION };
  }

  const used = await prisma.couponUsage.count({ where: { couponId: coupon.couponId } });
  if (used >= coupon.usageLimit) {
    // eslint-disable-next-line no-console
    console.info("[coupon.validate] reject", { code: code.slice(0, 32), reason: "usage_limit_reached" });
    return { valid: false, reason: GENERIC_REJECTION };
  }

  return {
    valid: true,
    code: coupon.code,
    couponId: coupon.couponId,
    discountType: coupon.discountType,
    discountValue: coupon.discountValue,
    store: coupon.store,
  };
}
