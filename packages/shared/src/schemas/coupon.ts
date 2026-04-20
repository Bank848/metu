import { z } from "zod";
import { DISCOUNT_TYPE } from "../enums";

export const validateCouponSchema = z.object({
  code: z.string().min(1).max(50),
});

export const couponInputSchema = z.object({
  code: z.string().min(3).max(50).regex(/^[A-Z0-9_-]+$/, "uppercase alphanumeric"),
  discountType: z.enum(DISCOUNT_TYPE),
  discountValue: z.number().int().positive(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  usageLimit: z.number().int().positive(),
  isActive: z.boolean().default(true),
});

export type ValidateCouponInput = z.infer<typeof validateCouponSchema>;
export type CouponInput = z.infer<typeof couponInputSchema>;
