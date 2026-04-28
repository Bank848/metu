/**
 * Phase 13.9 — seller resource DTOs + request schemas.
 *
 * Read-side (13.9.1) endpoints don't take request bodies — they
 * stay types-only.
 *
 * Write-side (13.9.2) re-exports zod schemas from @metu/shared so
 * the controller layer has a single import surface, plus a small
 * variant-patch schema lifted from the legacy BFF route.
 */
import { z } from "zod";
import {
  becomeSellerSchema,
  updateStoreSchema,
  productInputSchema,
  couponInputSchema,
} from "@metu/shared";

export {
  becomeSellerSchema,
  updateStoreSchema,
  productInputSchema,
  couponInputSchema,
};

/**
 * Targeted variant patch — bulk-edit page nudges price / discount /
 * stock without resending the whole product payload.
 */
export const patchVariantSchema = z.object({
  price: z.number().min(0).optional(),
  discountPercent: z.number().min(0).max(100).optional(),
  quantity: z.number().int().min(0).optional(),
});
export type PatchVariantInput = z.infer<typeof patchVariantSchema>;

/**
 * Order-status update — sellers can only move orders forward
 * (fulfilled) or sideways (cancelled). Pending → paid is the
 * checkout flow; refunded is its own endpoint.
 */
export const updateOrderStatusSchema = z.object({
  status: z.enum(["fulfilled", "cancelled"]),
});
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;


export interface SellerStatsResponse {
  store: unknown;
  productCount: number;
  kpi: {
    paidCount: number;
    totalRevenue: number;
    fulfilledCount: number;
    pendingCount: number;
  };
  dailyOrders: { day: Date; count: number }[];
  topProducts: {
    productId: number;
    name: string;
    revenue: number;
    units: number;
  }[];
  recentReviews: unknown[];
}
