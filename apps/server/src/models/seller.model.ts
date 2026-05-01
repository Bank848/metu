// Seller resource DTOs + request schemas. Re-exports the shared
// schemas for a single controller-side import surface.
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

/** Variant patch for bulk-edit nudges (price, discount, stock). */
export const patchVariantSchema = z.object({
  price: z.number().min(0).optional(),
  discountPercent: z.number().min(0).max(100).optional(),
  quantity: z.number().int().min(0).optional(),
});
export type PatchVariantInput = z.infer<typeof patchVariantSchema>;

/** Sellers can only move orders to fulfilled or cancelled. */
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
