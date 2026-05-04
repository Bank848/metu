import { prisma } from "../db/prisma.js";
import type { CouponValidateResult } from "../models/coupons.model.js";

/**
 * Validate a coupon code. Always returns 200 — `valid: true|false` +
 * a `reason` string for the client to surface inline. We deliberately
 * don't `throw AppError(404)` for "not found" because the cart UI
 * shows the rejection reason next to the input rather than treating
 * it as an HTTP error.
 * Failure ladder (matches the legacy BFF behaviour 1:1):
 *   1. row missing or `isActive=false` → "Coupon not found or inactive"
 *   2. now < startDate                  → "Coupon is not yet active"
 *   3. now > endDate                    → "Coupon has expired"
 *   4. usage >= usageLimit              → "Coupon usage limit reached"
 */
export async function validateCoupon(code: string): Promise<CouponValidateResult> {
  const coupon = await prisma.coupon.findFirst({
    where: { code, isActive: true },
    include: { store: { select: { storeId: true, name: true } } },
  });
  if (!coupon) return { valid: false, reason: "Coupon not found or inactive" };

  const now = new Date();
  if (now < coupon.startDate) return { valid: false, reason: "Coupon is not yet active" };
  if (now > coupon.endDate) return { valid: false, reason: "Coupon has expired" };

  const used = await prisma.couponUsage.count({ where: { couponId: coupon.couponId } });
  if (used >= coupon.usageLimit) {
    return { valid: false, reason: "Coupon usage limit reached" };
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
