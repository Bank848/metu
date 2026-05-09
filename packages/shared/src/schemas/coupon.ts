import { z } from "zod";
import { DISCOUNT_TYPE } from "../enums.js";

export const validateCouponSchema = z.object({
  code: z.string().min(1).max(50),
});

export const couponInputSchema = z
  .object({
    code: z.string().min(3).max(50).regex(/^[A-Z0-9_-]+$/, "uppercase alphanumeric"),
    discountType: z.enum(DISCOUNT_TYPE),
    discountValue: z.number().int().positive(),
    // Accept both YYYY-MM-DD (HTML <input type="date">) and full ISO. coerce.date()
    // parses either into a Date — refine() below reads them with .getTime() directly.
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    usageLimit: z.number().int().positive(),
    isActive: z.boolean().default(true),
  })
  // Percent coupons must be in [1, 100]. The runtime fix here is
  // important: the order-math at orders.service.ts caps discount at
  // eligible subtotal, but a 100%-off coupon still drops the order
  // total to ฿0 — the StripeMinimum guard sometimes catches it,
  // sometimes doesn't (depends on currency rounding). Reject at the
  // schema layer so sellers can't accidentally / maliciously mint
  // free-store coupons. Fixed-amount discounts (`fixed`) skip the
  // ≤100 ceiling because ฿100 fixed-off is a reasonable seller promo.
  .refine(
    (v) => v.discountType !== "percent" || v.discountValue <= 100,
    {
      message: "percent discount cannot exceed 100",
      path: ["discountValue"],
    },
  )
  // endDate must be on/after startDate. Earlier rev silently accepted
  // inverted dates — the coupon then never matched at checkout
  // (`endDate >= NOW()` and `startDate <= NOW()` can't both be true)
  // so sellers wondered why their "active" coupon wasn't applying.
  .refine(
    (v) => v.endDate.getTime() >= v.startDate.getTime(),
    {
      message: "endDate must be on or after startDate",
      path: ["endDate"],
    },
  )
  // 5-min grace so a form submitted right at the chosen minute still passes.
  .refine(
    (v) => v.startDate.getTime() >= Date.now() - 5 * 60_000,
    {
      message: "startDate cannot be in the past",
      path: ["startDate"],
    },
  )
  // 5-year ceiling — a 10y-future coupon would block its `code` slot
  // forever and amplifies C3-AD-004 master-vs-seller orderBy collision.
  .refine(
    (v) => v.startDate.getTime() <= Date.now() + 5 * 365 * 86_400_000,
    {
      message: "startDate must be within 5 years",
      path: ["startDate"],
    },
  );

export type ValidateCouponInput = z.infer<typeof validateCouponSchema>;
export type CouponInput = z.infer<typeof couponInputSchema>;
