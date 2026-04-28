/**
 * Phase 13.10 — admin resource: zod input schemas + DTOs.
 *
 * Re-uses no @metu/shared schemas because admin actions are server-
 * only (no shared form schemas like the seller side). Everything
 * lives here.
 */
import { z } from "zod";

export const ALLOWED_ROLES = ["buyer", "seller", "admin"] as const;
export type AdminRole = (typeof ALLOWED_ROLES)[number];

export const userListQuerySchema = z.object({
  q: z.string().optional(),
  role: z.enum(ALLOWED_ROLES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(60).default(20),
});
export type UserListQuery = z.infer<typeof userListQuerySchema>;

export const updateUserRoleSchema = z.object({
  role: z.enum(ALLOWED_ROLES),
});
export type UpdateUserRoleInput = z.infer<typeof updateUserRoleSchema>;

/**
 * DELETE /admin/users/:id body — optional reason. When supplied,
 * the user is BANNED (deletedAt + bannedAt + bannedReason set + audit
 * action 'user.ban'). When absent, the user is just SOFT-DELETED
 * (deletedAt only + audit action 'user.delete').
 *
 * Phase 12.2 distinguishes admin-removal-for-cause from
 * user-self-delete; this body shape is what carries that signal.
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
