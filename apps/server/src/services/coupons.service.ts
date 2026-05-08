import { prisma } from "../db/prisma.js";
import type { CouponValidateResult } from "../models/coupons.model.js";

// All failure modes return the same generic string so an attacker
// can't enumerate which codes exist. Precise reason goes to logs.
const GENERIC_REJECTION = "Coupon is not valid";

/**
 * Validate a coupon code. Always returns 200 — `valid: true|false` +
 * a generic `reason` for the cart UI to surface inline.
 */
export async function validateCoupon(code: string): Promise<CouponValidateResult> {
  // When the same code exists on both a master coupon and a seller's
  // coupon (rare but allowed by the schema's partial unique index),
  // pick the master coupon first — it's platform-wide so it carries
  // the broader intent and the seller coupon will still be findable
  // by its scoped UI flow. orderBy stabilises the lookup so the result
  // is deterministic instead of whichever Prisma feels like that day.
  const coupon = await prisma.coupon.findFirst({
    where: { code, isActive: true },
    include: { store: { select: { storeId: true, name: true } } },
    orderBy: [{ storeId: { sort: "asc", nulls: "first" } }, { couponId: "asc" }],
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
