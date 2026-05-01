// Coupon validate-only data contracts.
export {
  validateCouponSchema,
  type ValidateCouponInput,
} from "@metu/shared";

export type CouponValidateResult =
  | {
      valid: true;
      code: string;
      couponId: number;
      discountType: string;
      discountValue: number;
      /** null = master / platform-wide coupon. */
      store: { storeId: number; name: string } | null;
    }
  | {
      valid: false;
      reason: string;
    };
