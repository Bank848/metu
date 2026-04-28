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
}

/**
 * Detail / list responses are the raw Prisma row + nested includes.
 * Typing them by hand would just duplicate the schema — the order
 * receipt page consumes nearly every column.
 */
export type OrderDetail = Record<string, unknown>;
export type OrderListItem = Record<string, unknown>;
