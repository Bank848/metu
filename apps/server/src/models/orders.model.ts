/**
 * Orders data contracts.
 *
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
  /**
   * Phase 27 — present when Stripe is configured AND the order's
   * single store has completed Connect onboarding. The frontend uses
   * it with `<Elements>` + `<PaymentElement />` to confirm the
   * payment ; absence means the order is in demo mode (already
   * `paid`, no further action needed).
   */
  stripeClientSecret?: string | null;
}

/**
 * Detail / list responses are the raw Prisma row + nested includes.
 * Typing them by hand would just duplicate the schema — the order
 * receipt page consumes nearly every column.
 */
export type OrderDetail = Record<string, unknown>;
export type OrderListItem = Record<string, unknown>;
