/**
 * Phase 13.9 — seller resource DTOs.
 *
 * Read-side (13.9.1) endpoints don't take request bodies — every
 * filter is a URL query — so this file is types-only for now. The
 * write-side (13.9.2) will pull becomeSellerSchema /
 * productInputSchema / updateStoreSchema / couponInputSchema from
 * @metu/shared and re-export them here so the controller layer has
 * a single import surface.
 */

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
