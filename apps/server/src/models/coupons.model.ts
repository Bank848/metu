/**
 * Coupons data contracts (Phase 13.3 scope: validate only — seller
 * CRUD comes in Phase 13.9).
 */
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
      /** Phase 38C — null = master / platform-wide coupon. */
      store: { storeId: number; name: string } | null;
    }
  | {
      valid: false;
      reason: string;
    };
