// Admin resource: zod input schemas + DTOs.
import { z } from "zod";

export const ALLOWED_ROLES = ["buyer", "seller", "admin"] as const;
export type AdminRole = (typeof ALLOWED_ROLES)[number];

export const userListQuerySchema = z.object({
  q: z.string().optional(),
  role: z.enum(ALLOWED_ROLES).optional(),
  // `?status=banned` filters to bannedAt != null so the
  // operator's "Banned" chip on /admin/users only shows banned rows.
  status: z.enum(["banned"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(60).default(20),
});
export type UserListQuery = z.infer<typeof userListQuerySchema>;

export const updateUserRoleSchema = z.object({
  role: z.enum(ALLOWED_ROLES),
});
export type UpdateUserRoleInput = z.infer<typeof updateUserRoleSchema>;

/**
 * DELETE /admin/users/:id body. With reason: ban (sets deletedAt +
 * bannedAt + bannedReason, audits "user.ban"). Without: plain
 * soft-delete (deletedAt only, audits "user.delete").
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
  recentTransactions: unknown[];
  daily: { day: string; revenue: number; orderCount: number }[];
}
