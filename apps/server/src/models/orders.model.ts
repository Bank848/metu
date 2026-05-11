/**
 * Orders data contracts.
 * `checkoutSchema` lives in @metu/shared (the cart's checkout form
 * uses it client-side too). Response shapes are TS interfaces.
 */
export {
  checkoutSchema,
  type CheckoutInput,
} from "@metu/shared";

export interface CheckoutResponse {
  orderId: number;
  transactionId: number;
  total: number;
  subtotal: number;
  discount: number;
  /** Store the coupon was scoped to (null when no coupon was applied). */
  couponStoreId: number | null;
  /** Set when Stripe is wired and the store has completed onboarding;
   *  absence means demo mode (no further action needed). */
  stripeClientSecret?: string | null;
  /** True when total = 0 — order is already paid + fulfilled at
   *  checkout time, no Stripe redirect needed. */
  freeOrder?: boolean;
}

// Loose typing - detail/list responses are raw Prisma rows.
export type OrderDetail = Record<string, unknown>;
export type OrderListItem = Record<string, unknown>;
