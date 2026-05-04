import type { Request } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../db/prisma.js";
import { AppError } from "../utils/errors.js";
import { audit } from "../utils/audit.js";
import { refundOrder as stripeRefund } from "./stripe.service.js";
import { PUBLIC_SITE_URL } from "../config.js";
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
  // `?status=banned` filter for the new "Banned" chip on the
  // /admin/users page. Default view hides anonymised rows (their email
  // starts with `deleted_` per `deleteUser`'s anonymise path) so the
  // operator's table stays clean.
  const statusWhere =
    q.status === "banned"
      ? { bannedAt: { not: null } }
      : {
          // Hide anonymised rows from the default view. Banned (with
          // reason) accounts still show because their email isn't
          // deleted_*.
          email: { not: { startsWith: "deleted_" } },
        };

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
    ...statusWhere,
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
        // Pull deletedAt so we can hide the store column for sellers
        // whose store was soft-deleted from /admin/stores. Without
        // this, the row kept showing the dead store's name even
        // though /admin/stores itself dropped the row.
        store: { select: { storeId: true, name: true, deletedAt: true } },
      },
    }),
    prisma.user.count({ where }),
  ]);

  return {
    // Strip `password` even though it might be hashed — admin UI
    // never needs it and accidental log-leak risk is real.
    items: items.map(({ password, store, ...u }) => ({
      ...u,
      // null out store when it's been
      // soft-deleted so /admin/users reflects the real "no active
      // store" state instead of pointing at a tombstoned row.
      store: store && !store.deletedAt
        ? { storeId: store.storeId, name: store.name }
        : null,
    })),
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
 * also handles store side effects so the role flip
 * actually means something in the rest of the app:
 *   - to "seller" + user has no active store → auto-create one
 *     (or restore a soft-deleted one) via
 *     `seller.service.adminCreateStore`.
 *   - to "buyer" + user owns an active store → soft-delete the
 *     store via `deleteStore` so the new role isn't contradicted
 *     by a still-live storefront.
 *   - to "admin" → role flip only; existing stores stay as-is.
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

  // Capture previous role + username for the audit trail + the
  // auto-store-create default name.
  const target = await prisma.user.findUnique({
    where: { userId: targetUserId },
    select: {
      username: true,
      stats: { select: { role: true } },
      store: { select: { storeId: true, deletedAt: true } },
    },
  });
  if (!target) throw new AppError(404, "UserNotFound");
  const prevRole = target.stats?.role ?? null;

  // Side effects BEFORE the role flip so the audit chain reads in
  // execution order: store.create / store.delete first, then the
  // role-change row.
  const sideEffectMeta: Record<string, unknown> = {};

  if (input.role === "seller") {
    const { adminCreateStore } = await import("./seller.service.js");
    const result = await adminCreateStore(targetUserId, target.username);
    sideEffectMeta.storeId = result.storeId;
    if (result.action === "created") {
      sideEffectMeta.autoCreatedStoreId = result.storeId;
      await audit({
        actorId: actorUserId,
        action: "store.create",
        targetType: "store",
        targetId: result.storeId,
        meta: { ownerId: targetUserId, byAdmin: actorUserId, defaulted: true },
        req,
      });
    } else if (result.action === "restored") {
      sideEffectMeta.restoredStoreId = result.storeId;
      await audit({
        actorId: actorUserId,
        action: "store.restore",
        targetType: "store",
        targetId: result.storeId,
        meta: { ownerId: targetUserId, byAdmin: actorUserId },
        req,
      });
    }
  }

  if (input.role === "buyer" && target.store && !target.store.deletedAt) {
    sideEffectMeta.deletedStoreId = target.store.storeId;
    // Re-uses the existing soft-delete + audit row.
    await deleteStore(target.store.storeId, actorUserId, req);
  }

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
    meta: { from: prevRole, to: input.role, ...sideEffectMeta },
    req,
  });
}

/**
 * three-path remove flow:
 *   - reason supplied → ban (existing soft-delete + bannedAt + bannedReason,
 *     "Banned" badge stays for moderation accountability).
 *   - no reason + fresh account (no orders/reviews/transactions) →
 *     hard-delete via prisma.user.delete(); cascades take care of cart,
 *     session, account, favourite. Row truly disappears from /admin/users.
 *   - no reason + has business history → anonymise: blank PII, clear
 *     password/totp, set deletedAt, drop sessions + accounts. Order /
 *     review / transaction history stays intact so seller analytics
 *     don't break. listUsers filters anonymised rows out so the
 *     "Deleted" badge no longer lingers on the operator's screen.
 * Also blocks removing the only remaining admin so an operator can't
 * lock the marketplace out of admin entirely.
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

  // Last-admin guard — only enforced when target is an admin.
  const targetStats = await prisma.userStats.findUnique({
    where: { userId: targetUserId },
    select: { role: true },
  });
  if (targetStats?.role === "admin") {
    const liveAdmins = await prisma.userStats.count({
      where: { role: "admin", user: { deletedAt: null } },
    });
    if (liveAdmins <= 1) {
      throw new AppError(
        400,
        "LastAdminCannotBeRemoved",
        "Can't remove the only remaining admin. Promote another admin first.",
      );
    }
  }

  // Ban path: soft-delete + drop sessions so the next request 401s.
  if (reason) {
    const now = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { userId: targetUserId },
        data: { deletedAt: now, bannedAt: now, bannedReason: reason },
      });
      await tx.session.deleteMany({ where: { userId: targetUserId } });
    });
    await audit({
      actorId: actorUserId,
      action: "user.ban",
      targetType: "user",
      targetId: targetUserId,
      meta: { reason },
      req,
    });
    return;
  }

  // REMOVE PATH — branch on history.
  const [orderCount, reviewCount, txCount] = await Promise.all([
    prisma.order.count({ where: { userId: targetUserId } }),
    prisma.productReview.count({ where: { userId: targetUserId } }),
    prisma.transaction.count({ where: { userId: targetUserId } }),
  ]);
  const historyCount = orderCount + reviewCount + txCount;

  // Audit BEFORE the destructive op so the trail still references the row.
  await audit({
    actorId: actorUserId,
    action: historyCount > 0 ? "user.anonymize" : "user.delete",
    targetType: "user",
    targetId: targetUserId,
    meta: { historyCount, byAdmin: actorUserId },
    req,
  });

  if (historyCount === 0) {
    // Fresh account — hard delete + cascade.
    await prisma.user.delete({ where: { userId: targetUserId } });
    return;
  }

  // Anonymise: blank PII, clear auth state, soft-delete the row,
  // drop sessions + better-auth accounts so the user can't log back in.
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { userId: targetUserId },
      data: {
        email: `deleted_${targetUserId}@deleted.invalid`,
        username: `deleted_user_${targetUserId}`,
        firstName: "Deleted",
        lastName: "User",
        phone: null,
        profileImage: null,
        dateOfBirth: null,
        password: null,
        totpSecret: null,
        totpEnabled: false,
        deletedAt: new Date(),
        requirePasswordReset: false,
      },
    });
    await tx.session.deleteMany({ where: { userId: targetUserId } });
    await tx.account.deleteMany({ where: { userId: targetUserId } });
  });
}

/**
 * clears `bannedAt` + `bannedReason` + `deletedAt` so the
 * user can sign in again. Doesn't touch role / store / order history.
 * Used by the new "Unban" row action when admin filters
 * /admin/users by `status=banned`.
 */
export async function unbanUser(
  targetUserId: number,
  actorUserId: number,
  req?: AuditReq,
): Promise<void> {
  const target = await prisma.user.findUnique({
    where: { userId: targetUserId },
    select: { bannedAt: true, bannedReason: true },
  });
  if (!target) throw new AppError(404, "UserNotFound");
  if (!target.bannedAt) {
    throw new AppError(400, "NotBanned", "This user isn't banned.");
  }
  await prisma.user.update({
    where: { userId: targetUserId },
    data: { bannedAt: null, bannedReason: null, deletedAt: null },
  });
  await audit({
    actorId: actorUserId,
    action: "user.unban",
    targetType: "user",
    targetId: targetUserId,
    meta: { previousReason: target.bannedReason ?? null },
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

  // idempotency: refuse if every linked order is already
  // refunded. Previously calling this twice created two negative
  // payout rows, double-debiting the ledger.
  if (tx.orders.length > 0 && tx.orders.every((o) => o.status === "refunded")) {
    throw new AppError(409, "AlreadyRefunded", "This transaction has already been refunded.");
  }

  // actually call Stripe for any orders that have a PI.
  // Each order can be on a different connected account, so we iterate.
  // If any single Stripe call fails, we bail out before touching the
  // DB so the operator can retry without partial state.
  const stripeRefundIds: Record<number, string> = {};
  for (const o of tx.orders) {
    if (o.status === "refunded") continue;
    if (!o.stripePaymentIntentId) continue;
    const lineWithStore = await prisma.orderItem.findFirst({
      where: { orderId: o.orderId },
      select: { productItem: { select: { product: { select: { store: { select: { stripeAccountId: true } } } } } } },
    });
    const acct = lineWithStore?.productItem.product.store.stripeAccountId;
    if (!acct) continue;
    try {
      const refund = await stripeRefund(o.stripePaymentIntentId, acct);
      stripeRefundIds[o.orderId] = refund.id;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[admin.refund] Stripe refund failed for order", o.orderId, err);
      throw new AppError(
        502,
        "StripeRefundFailed",
        "Stripe declined one of the order refunds. Nothing has been changed in the DB; try again or refund the order individually.",
      );
    }
  }

  await prisma.$transaction([
    prisma.order.updateMany({
      where: { transactionId, status: { not: "refunded" } },
      data: { status: "refunded" },
    }),
    // TransactionType enum is now { purchase, payout } per
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
  const updated = await prisma.user.update({
    where: { userId: targetUserId },
    data: { requirePasswordReset: value },
    select: { email: true, firstName: true },
  });

  // out-of-band notification when an admin flags the
  // account so the user isn't surprised by the redirect on next
  // login. Email failure is non-blocking — the flag still flips
  // because the operator's intent is what matters.
  let emailSent = false;
  if (value) {
    try {
      const { sendEmail } = await import("../utils/email.js");
      const greeting = updated.firstName ? `Hi ${updated.firstName},` : "Hi,";
      const baseUrl = PUBLIC_SITE_URL;
      const html = `
        <p>${greeting}</p>
        <p>An administrator has flagged your METU account for a
        password reset. The next time you sign in you'll be redirected
        to <strong>Profile → Edit</strong> until a new password is set.</p>
        <p style="margin-top:24px">
          <a href="${baseUrl}/profile/edit?must-reset=1"
             style="background:#FBBF24;color:#0b1220;padding:12px 24px;
                    border-radius:9999px;text-decoration:none;
                    font-weight:600;">
            Reset your password →
          </a>
        </p>
        <p style="font-size:12px;color:#64748b;margin-top:32px">
          If you didn't expect this, contact METU support so we can
          investigate the request.
        </p>`;
      const result = await sendEmail({
        to: updated.email,
        subject: "Action required: reset your METU password",
        html,
      });
      emailSent = result.ok;
    } catch (err) {
      // Don't bail — the flag flip is what counts. Log + audit `false`.
      console.error("[setRequirePasswordReset] email send failed:", err);
    }
  }

  await audit({
    actorId: actorUserId,
    action: value
      ? "user.require_password_reset.set"
      : "user.require_password_reset.clear",
    targetType: "user",
    targetId: targetUserId,
    meta: value ? { emailSent } : undefined,
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
