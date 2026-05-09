// Admin resource: zod input schemas + DTOs.
import { z } from "zod";

export const ALLOWED_ROLES = ["buyer", "seller", "admin"] as const;
export type AdminRole = (typeof ALLOWED_ROLES)[number];

export const userListQuerySchema = z.object({
  q: z.string().optional(),
  role: z.enum(ALLOWED_ROLES).optional(),
  status: z.enum(["banned"]).optional(),
  // Demographic + level filters per requirements doc.
  gender: z.enum(["male", "female", "other"]).optional(),
  countryId: z.coerce.number().int().positive().optional(),
  buyerLevel: z.coerce.number().int().min(0).optional(),
  sellerLevel: z.coerce.number().int().min(0).optional(),
  signupAfter: z.string().optional(),
  signupBefore: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(60).default(20),
});
export type UserListQuery = z.infer<typeof userListQuerySchema>;

export const updateUserRoleSchema = z.object({
  role: z.enum(ALLOWED_ROLES),
});
export type UpdateUserRoleInput = z.infer<typeof updateUserRoleSchema>;

/**
 * DELETE /admin/users/:id body. With reason → ban (sets bannedAt +
 * bannedReason; row stays so it can be unbanned, audits "user.ban").
 * Without reason → hard-delete for fresh accounts or anonymise for
 * accounts with order/review/transaction history (audits "user.delete"
 * or "user.anonymize" respectively).
 */
export const deleteUserSchema = z.object({
  reason: z.string().optional(),
});
export type DeleteUserInput = z.infer<typeof deleteUserSchema>;

export const REPORT_NAMES = [
  "revenue-by-category",
  "top-stores",
  "orders-by-status",
  "signups-per-day",
  "coupon-usage",
] as const;
export type ReportName = (typeof REPORT_NAMES)[number];

export interface AdminStatsResponse {
  users: number;
  stores: number;
  products: number;
  reviews: number;
  orders: number;
  gmv: number;
  pendingOrders: number;
  /** Net platform fee captured on settled orders, in baht (after refund clawback). */
  platformEarnings: number;
  /** Current platformFeePercent applied — surfaced for the KPI card subtitle. */
  platformFeePercent: number;
  recentTransactions: unknown[];
  daily: { day: string; revenue: number; orderCount: number }[];
}
