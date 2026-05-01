import type { Request } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../db/prisma.js";
import { AppError } from "../utils/errors.js";
import { audit } from "../utils/audit.js";
import {
  type UserListQuery,
  type UpdateUserRoleInput,
  type DeleteUserInput,
  type AdminStatsResponse,
  type ReportName,
} from "../models/admin.model.js";

// Narrow type so services don't have to drag in the full Express.Request.
type AuditReq = Pick<Request, "ip" | "headers"> | null | undefined;

// Admin service. Pure functions taking ids/params; destructive
// actions write an AuditLog row through utils/audit.ts.

export async function listUsers(q: UserListQuery) {
  const where = {
    ...(q.q
      ? {
          OR: [
            { username: { contains: q.q, mode: "insensitive" as const } },
            { email: { contains: q.q, mode: "insensitive" as const } },
            { firstName: { contains: q.q, mode: "insensitive" as const } },
            { lastName: { contains: q.q, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(q.role ? { stats: { role: q.role } } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
      orderBy: { createdDate: "desc" },
      include: {
        country: true,
        stats: true,
        store: { select: { storeId: true, name: true } },
      },
    }),
    prisma.user.count({ where }),
  ]);

  return {
    // Strip `password` even though it might be hashed — admin UI
    // never needs it and accidental log-leak risk is real.
    items: items.map(({ password, ...u }) => u),
    page: q.page,
    pageSize: q.pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / q.pageSize)),
  };
}

/**
 * Change a user's role. Self-demote forbidden — an admin removing
 * their own admin role would lock themselves out of the very page
 * they're using.
 */
export async function updateUserRole(
  targetUserId: number,
  actorUserId: number,
  input: UpdateUserRoleInput,
  req?: AuditReq,
) {
  if (targetUserId === actorUserId && input.role !== "admin") {
    throw new AppError(
      400,
      "SelfDemoteForbidden",
      "You cannot remove your own admin role.",
    );
  }

  // Capture previous role for the audit trail (so we can answer
  // "what changed?" not just "what is it now?")
  const prev = await prisma.userStats.findUnique({
    where: { userId: targetUserId },
    select: { role: true },
  });

  await prisma.userStats.upsert({
    where: { userId: targetUserId },
    update: { role: input.role },
    create: { userId: targetUserId, role: input.role },
  });

  await audit({
    actorId: actorUserId,
    action: "user.role_change",
    targetType: "user",
    targetId: targetUserId,
    meta: { from: prev?.role ?? null, to: input.role },
    req,
  });
}

/**
 * Soft-delete a user. With `reason`, treats it as a ban (sets
 * bannedAt + bannedReason, audits "user.ban"). Self-delete forbidden.
 */
export async function deleteUser(
  targetUserId: number,
  actorUserId: number,
  input: DeleteUserInput,
  req?: AuditReq,
) {
  if (targetUserId === actorUserId) {
    throw new AppError(
      400,
      "SelfDeleteForbidden",
      "You cannot delete your own account.",
    );
  }

  const rawReason = input.reason?.trim() ?? "";
  const reason = rawReason.length > 0 ? rawReason.slice(0, 120) : null;
  const now = new Date();

  await prisma.user.update({
    where: { userId: targetUserId },
    data: {
      deletedAt: now,
      ...(reason ? { bannedAt: now, bannedReason: reason } : {}),
    },
  });

  await audit({
    actorId: actorUserId,
    action: reason ? "user.ban" : "user.delete",
    targetType: "user",
    targetId: targetUserId,
    meta: reason ? { reason } : undefined,
    req,
  });
}

// =============================================================================
//  STORES
/**
 * Excludes soft-deleted stores so counts match /browse + /admin overview.
 */
export async function listStores() {
  return prisma.store.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" },
    include: {
      owner: {
        select: {
          username: true,
          firstName: true,
          lastName: true,
          profileImage: true,
        },
      },
      businessType: true,
      stats: true,
      _count: {
        select: { products: { where: { deletedAt: null } } },
      },
    },
  });
}

/** Soft-delete a store + audit row. Order/review history stays valid. */
export async function deleteStore(storeId: number, actorUserId: number, req?: AuditReq) {
  await prisma.store.update({
    where: { storeId },
    data: { deletedAt: new Date() },
  });
  await audit({
    actorId: actorUserId,
    action: "store.delete",
    targetType: "store",
    targetId: storeId,
    req,
  });
}

/**
 * Reversible store suspension. Sets/clears suspendedAt; suspended
 * stores hide from public surfaces but remain visible to the seller.
 */
export async function setStoreSuspended(
  storeId: number,
  actorUserId: number,
  value: boolean,
  req?: AuditReq,
): Promise<void> {
  await prisma.store.update({
    where: { storeId },
    data: { suspendedAt: value ? new Date() : null },
  });
  await audit({
    actorId: actorUserId,
    action: value ? "store.suspend" : "store.unsuspend",
    targetType: "store",
    targetId: storeId,
    req,
  });
}

// =============================================================================
//  STATS — composite dashboard payload
// =============================================================================

export async function getStats(): Promise<AdminStatsResponse> {
  const [
    users,
    stores,
    products,
    reviews,
    orders,
    gmv,
    pendingOrders,
    recentTransactions,
    daily,
  ] = await Promise.all([
    prisma.user.count({ where: { deletedAt: null } }),
    prisma.store.count({ where: { deletedAt: null } }),
    // Gates on live store too so KPIs match /browse counts.
    prisma.product.count({
      where: { deletedAt: null, store: { deletedAt: null } },
    }),
    prisma.productReview.count(),
    prisma.order.count(),
    prisma.$queryRaw<Array<{ total: string }>>`
      SELECT COALESCE(SUM(total_price), 0)::text AS total
      FROM orders
      WHERE status IN ('paid', 'fulfilled')
    `,
    prisma.order.count({ where: { status: "pending" } }),
    prisma.transaction.findMany({
      orderBy: { createdAt: "desc" },
      take: 30,
      include: {
        user: {
          select: {
            username: true,
            firstName: true,
            lastName: true,
            profileImage: true,
          },
        },
      },
    }),
    prisma.$queryRaw<
      Array<{ day: string; revenue: string; order_count: bigint }>
    >`
      SELECT
        TO_CHAR(d::date, 'YYYY-MM-DD')                                    AS day,
        COALESCE(SUM(o.total_price) FILTER (WHERE o.status IN ('paid','fulfilled')), 0)::text AS revenue,
        COUNT(o.order_id) FILTER (WHERE o.status IN ('paid','fulfilled')) AS order_count
      FROM generate_series(CURRENT_DATE - INTERVAL '13 days', CURRENT_DATE, INTERVAL '1 day') d
      LEFT JOIN orders o
        ON DATE(o.created_at) = d::date
      GROUP BY d
      ORDER BY d ASC
    `,
  ]);

  return {
    users,
    stores,
    products,
    reviews,
    orders,
    gmv: Number(gmv[0]?.total ?? 0),
    pendingOrders,
    recentTransactions,
    daily: daily.map((d) => ({
      day: d.day,
      revenue: Number(d.revenue),
      orderCount: Number(d.order_count),
    })),
  };
}

// =============================================================================
//  TRANSACTIONS
// =============================================================================

/**
 * Hard-delete a transaction. Money records are either there or not
 * — no soft-delete column. Snapshot before delete so the audit row
 * keeps the amount + type.
 */
export async function deleteTransaction(
  transactionId: number,
  actorUserId: number,
  req?: AuditReq,
) {
  const snap = await prisma.transaction.findUnique({
    where: { transactionId },
    select: { userId: true, transactionType: true, totalAmount: true },
  });
  await prisma.transaction.delete({ where: { transactionId } });
  await audit({
    actorId: actorUserId,
    action: "transaction.delete",
    targetType: "transaction",
    targetId: transactionId,
    meta: snap
      ? {
          userId: snap.userId,
          type: snap.transactionType,
          amount: Number(snap.totalAmount),
        }
      : null,
    req,
  });
}

/**
 * Refund a purchase: mark all linked orders refunded + insert a
 * matching `refund` Transaction. Refuses non-purchase types because
 * refunding a refund makes no sense.
 */
export async function refundTransaction(
  transactionId: number,
  actorUserId: number,
  req?: AuditReq,
) {
  const tx = await prisma.transaction.findUnique({
    where: { transactionId },
    include: { orders: true },
  });
  if (!tx) throw new AppError(404, "NotFound");
  if (tx.transactionType !== "purchase") {
    throw new AppError(
      400,
      "NotPurchase",
      "Only purchase transactions can be refunded.",
    );
  }

  await prisma.$transaction([
    prisma.order.updateMany({
      where: { transactionId },
      data: { status: "refunded" },
    }),
    // Phase 45 — TransactionType enum is now { purchase, payout } per
    // the docx report. A refund logs as a "payout" with a negative
    // amount (the platform paying the buyer back).
    prisma.transaction.create({
      data: {
        userId: tx.userId,
        transactionType: "payout",
        totalAmount: new Prisma.Decimal(tx.totalAmount).neg(),
      },
    }),
  ]);

  await audit({
    actorId: actorUserId,
    action: "transaction.refund",
    targetType: "transaction",
    targetId: transactionId,
    meta: {
      userId: tx.userId,
      amount: Number(tx.totalAmount),
      ordersAffected: tx.orders.length,
    },
    req,
  });
}

/**
 * Admin force-password-reset toggle. While true, the BFF redirects
 * authed pages to /profile/edit until the user changes their password.
 * Self-toggle forbidden.
 */
export async function setRequirePasswordReset(
  targetUserId: number,
  actorUserId: number,
  value: boolean,
  req?: AuditReq,
): Promise<void> {
  if (targetUserId === actorUserId) {
    throw new AppError(
      400,
      "SelfToggleForbidden",
      "You cannot force-reset your own password from here.",
    );
  }
  await prisma.user.update({
    where: { userId: targetUserId },
    data: { requirePasswordReset: value },
  });
  await audit({
    actorId: actorUserId,
    action: value
      ? "user.require_password_reset.set"
      : "user.require_password_reset.clear",
    targetType: "user",
    targetId: targetUserId,
    req,
  });
}

// =============================================================================
//  REPORTS — five named queries, raw SQL with ?-name dispatch
// =============================================================================

/**
 * Returns the SQL string + the rows it produced. The SQL string is
 * exposed in the response so the admin reports page can show
 * "here's what we ran" — useful for the demo viva ("look, the
 * product is honest about its queries").
 */
export async function runReport(
  name: ReportName,
): Promise<{ sql: string; rows: unknown[] }> {
  switch (name) {
    case "revenue-by-category": {
      const sql = `
SELECT c.category_id, c.category_name,
       SUM(oi.price_per_unit * oi.quantity)::text AS revenue,
       COUNT(DISTINCT o.order_id)::bigint AS orders
FROM orders o
JOIN order_item oi  ON oi.order_id = o.order_id
JOIN product_item pi ON pi.product_item_id = oi.product_item_id
JOIN product p       ON p.product_id = pi.product_id
JOIN store s         ON s.store_id = p.store_id
JOIN category c      ON c.category_id = p.category_id
WHERE o.status IN ('paid','fulfilled')
  AND p.deleted_at IS NULL
  AND s.deleted_at IS NULL
GROUP BY c.category_id, c.category_name
ORDER BY revenue DESC`;
      const rows = await prisma.$queryRaw<
        Array<{
          category_id: number;
          category_name: string;
          revenue: string;
          orders: bigint;
        }>
      >`
        SELECT c.category_id, c.category_name,
               SUM(oi.price_per_unit * oi.quantity)::text AS revenue,
               COUNT(DISTINCT o.order_id)::bigint AS orders
        FROM orders o
        JOIN order_item oi  ON oi.order_id = o.order_id
        JOIN product_item pi ON pi.product_item_id = oi.product_item_id
        JOIN product p       ON p.product_id = pi.product_id
        JOIN store s         ON s.store_id = p.store_id
        JOIN category c      ON c.category_id = p.category_id
        WHERE o.status IN ('paid','fulfilled')
          AND p.deleted_at IS NULL
          AND s.deleted_at IS NULL
        GROUP BY c.category_id, c.category_name
        ORDER BY revenue DESC
      `;
      return {
        sql,
        rows: rows.map((r) => ({
          ...r,
          orders: Number(r.orders),
          revenue: Number(r.revenue),
        })),
      };
    }
    case "top-stores": {
      const sql = `
SELECT s.store_id, s.name,
       COALESCE(SUM(oi.price_per_unit * oi.quantity), 0)::text AS revenue,
       COUNT(DISTINCT o.order_id)::bigint AS orders
FROM store s
LEFT JOIN product p       ON p.store_id = s.store_id
LEFT JOIN product_item pi ON pi.product_id = p.product_id
LEFT JOIN order_item oi   ON oi.product_item_id = pi.product_item_id
LEFT JOIN orders o        ON o.order_id = oi.order_id AND o.status IN ('paid','fulfilled')
WHERE s.deleted_at IS NULL
GROUP BY s.store_id, s.name
ORDER BY revenue DESC
LIMIT 10`;
      const rows = await prisma.$queryRaw<
        Array<{ store_id: number; name: string; revenue: string; orders: bigint }>
      >`
        SELECT s.store_id, s.name,
               COALESCE(SUM(oi.price_per_unit * oi.quantity), 0)::text AS revenue,
               COUNT(DISTINCT o.order_id)::bigint AS orders
        FROM store s
        LEFT JOIN product p       ON p.store_id = s.store_id
        LEFT JOIN product_item pi ON pi.product_id = p.product_id
        LEFT JOIN order_item oi   ON oi.product_item_id = pi.product_item_id
        LEFT JOIN orders o        ON o.order_id = oi.order_id AND o.status IN ('paid','fulfilled')
        WHERE s.deleted_at IS NULL
        GROUP BY s.store_id, s.name
        ORDER BY revenue DESC
        LIMIT 10
      `;
      return {
        sql,
        rows: rows.map((r) => ({
          ...r,
          orders: Number(r.orders),
          revenue: Number(r.revenue),
        })),
      };
    }
    case "orders-by-status": {
      const sql = `SELECT status, COUNT(*)::bigint AS count FROM orders GROUP BY status ORDER BY count DESC`;
      const rows = await prisma.$queryRaw<
        Array<{ status: string; count: bigint }>
      >`
        SELECT status::text, COUNT(*)::bigint AS count FROM orders GROUP BY status ORDER BY count DESC
      `;
      return {
        sql,
        rows: rows.map((r) => ({ ...r, count: Number(r.count) })),
      };
    }
    case "signups-per-day": {
      const sql = `
SELECT DATE_TRUNC('day', created_date)::date AS day, COUNT(*)::bigint AS count
FROM "users"
WHERE created_date >= NOW() - INTERVAL '60 days'
GROUP BY day ORDER BY day`;
      const rows = await prisma.$queryRaw<
        Array<{ day: Date; count: bigint }>
      >`
        SELECT DATE_TRUNC('day', created_date)::date AS day, COUNT(*)::bigint AS count
        FROM "users"
        WHERE created_date >= NOW() - INTERVAL '60 days'
        GROUP BY day ORDER BY day
      `;
      return {
        sql,
        rows: rows.map((r) => ({ ...r, count: Number(r.count) })),
      };
    }
    case "coupon-usage": {
      const sql = `
SELECT c.code, c.discount_type, c.discount_value,
       COUNT(cu.usage_id)::bigint AS times_used, c.usage_limit
FROM coupon c
LEFT JOIN coupon_usage cu ON cu.coupon_id = c.coupon_id
GROUP BY c.coupon_id, c.code, c.discount_type, c.discount_value, c.usage_limit
ORDER BY times_used DESC`;
      const rows = await prisma.$queryRaw<
        Array<{
          code: string;
          discount_type: string;
          discount_value: number;
          times_used: bigint;
          usage_limit: number;
        }>
      >`
        SELECT c.code, c.discount_type::text, c.discount_value,
               COUNT(cu.usage_id)::bigint AS times_used, c.usage_limit
        FROM coupon c
        LEFT JOIN coupon_usage cu ON cu.coupon_id = c.coupon_id
        GROUP BY c.coupon_id, c.code, c.discount_type, c.discount_value, c.usage_limit
        ORDER BY times_used DESC
      `;
      return {
        sql,
        rows: rows.map((r) => ({ ...r, times_used: Number(r.times_used) })),
      };
    }
  }
}
