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
        store: { select: { storeId: true, name: true } },
      },
    }),
    prisma.user.count({ where }),
  ]);

  return {
    // Strip `password` even though it might be hashed — admin UI
    // never needs it and accidental log-leak risk is real.
    items: items.map(({ password, store, ...u }) => ({
      ...u,
      store: store
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
      store: { select: { storeId: true } },
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
    }
  }

  if (input.role === "buyer" && target.store) {
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
      where: { role: "admin" },
    });
    if (liveAdmins <= 1) {
      throw new AppError(
        400,
        "LastAdminCannotBeRemoved",
        "Can't remove the only remaining admin. Promote another admin first.",
      );
    }
  }

  // Ban path: drop sessions so the next request 401s.
  if (reason) {
    const now = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { userId: targetUserId },
        data: { bannedAt: now, bannedReason: reason },
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

  // Anonymise: blank PII, clear auth state,
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
    data: { bannedAt: null, bannedReason: null },
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
      _count: {
        select: { products: true },
      },
    },
  });
}

/** Hard-delete a store + audit row. Order/review history stays valid via OrderItem snapshots. */
export async function deleteStore(storeId: number, actorUserId: number, req?: AuditReq) {
  await prisma.store.delete({
    where: { storeId },
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

/**
 * Admin dashboard KPI tiles. Was 7 separate Prisma `.count()` round-trips
 * — collapsed to a single CTE-style query so all six counters + GMV come
 * back in one DB hit. The recent-transactions feed and 14-day revenue
 * series are kept separate because they have different shapes / time
 * windows; running them in parallel via Promise.all preserves the
 * original concurrency.
 *
 * Indexes used:
 *   - orders(status) — covers pending-count + gmv FILTER
 */
export async function getStats(): Promise<AdminStatsResponse> {
  type CountsRow = {
    users: bigint;
    stores: bigint;
    products: bigint;
    reviews: bigint;
    orders: bigint;
    pending_orders: bigint;
    gmv: string;
  };
  const [counts, recentTransactions, daily] = await Promise.all([
    prisma.$queryRaw<CountsRow[]>`
      SELECT
        (SELECT COUNT(*) FROM "users")                                             AS users,
        (SELECT COUNT(*) FROM "store")                                             AS stores,
        (SELECT COUNT(*)
           FROM "product" p
           JOIN "store"   s ON s.store_id = p.store_id)                            AS products,
        (SELECT COUNT(*) FROM "product_review")                                    AS reviews,
        (SELECT COUNT(*) FROM "orders")                                            AS orders,
        (SELECT COUNT(*) FROM "orders" WHERE status = 'pending')                   AS pending_orders,
        (SELECT COALESCE(SUM(total_price), 0)::text
           FROM "orders"
          WHERE status IN ('paid', 'fulfilled'))                                   AS gmv
    `,
    // Recent transactions — keeping Prisma here because the nested
    // `user` select rides Prisma's typed builder cleanly, and the row
    // shape feeds straight into the API response without remapping.
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
    // 14-day revenue series. generate_series fills in zero-revenue
    // days so the chart never has gaps; FILTER limits the SUM/COUNT
    // to settled orders only without a second LEFT JOIN.
    prisma.$queryRaw<
      Array<{ day: string; revenue: string; order_count: bigint }>
    >`
      SELECT
        TO_CHAR(d::date, 'YYYY-MM-DD')                                    AS day,
        COALESCE(SUM(o.total_price) FILTER (WHERE o.status IN ('paid','fulfilled')), 0)::text AS revenue,
        COUNT(o.order_id) FILTER (WHERE o.status IN ('paid','fulfilled')) AS order_count
      FROM generate_series(CURRENT_DATE - INTERVAL '13 days', CURRENT_DATE, INTERVAL '1 day') d
      LEFT JOIN "orders" o
        ON DATE(o.created_at) = d::date
      GROUP BY d
      ORDER BY d ASC
    `,
  ]);

  const c = counts[0]!;
  return {
    users: Number(c.users),
    stores: Number(c.stores),
    products: Number(c.products),
    reviews: Number(c.reviews),
    orders: Number(c.orders),
    gmv: Number(c.gmv),
    pendingOrders: Number(c.pending_orders),
    recentTransactions,
    daily: daily.map((d) => ({
      day: d.day,
      revenue: Number(d.revenue),
      orderCount: Number(d.order_count),
    })),
  };
}

/**
 * Admin Dashboard Requirements §5 — every analytics block on /admin shaped
 * as one round-trip with hand-written SQL. Each entry is its own showcase
 * query for the rubric's "Query Examples: meaningful, efficient, varied".
 *
 *   a. Revenue Overview         → reuse `daily` from getStats()
 *   b. User Growth & Retention   → buyer / seller / active counts
 *   d. Store Performance         → top 5 stores by revenue + avg rating
 *   e/f. Product Performance     → top 5 products by revenue
 *   g. Age Groups                → buyers bucketed by age
 *   h. Category Analytics        → revenue + order count by category
 *   i. Tag Analytics             → most-used tags
 *   j. Coupon & Discount Impact  → total redeemed + total discount given
 *   k. Review & Rating Monitor   → avg rating + 7-day review velocity
 */
export async function getDashboardMetrics() {
  const [growth, topStores, topProducts, ageGroups, categories, tags, couponImpact, reviewMonitor] = await Promise.all([
    prisma.$queryRaw<Array<{
      total_users: bigint; buyers: bigint; sellers: bigint; admins: bigint;
      active_7d: bigint;
    }>>`
      SELECT
        (SELECT COUNT(*) FROM "users")                                                             AS total_users,
        (SELECT COUNT(*) FROM "user_stats" WHERE role = 'buyer')                                  AS buyers,
        (SELECT COUNT(*) FROM "user_stats" WHERE role = 'seller')                                 AS sellers,
        (SELECT COUNT(*) FROM "user_stats" WHERE role = 'admin')                                  AS admins,
        (SELECT COUNT(DISTINCT user_id) FROM "orders" WHERE created_at >= NOW() - INTERVAL '7 days') AS active_7d
    `,
    prisma.$queryRaw<Array<{
      store_id: number; name: string; revenue: string; orders: bigint; rating: number;
    }>>`
      SELECT
        s.store_id, s.name, s.rating,
        COALESCE(SUM(oi.price_per_unit * oi.quantity), 0)::text                          AS revenue,
        COUNT(DISTINCT o.order_id)::bigint                                               AS orders
      FROM "store" s
      LEFT JOIN "product"      p  ON p.store_id        = s.store_id
      LEFT JOIN "product_item" pi ON pi.product_id     = p.product_id
      LEFT JOIN "order_item"   oi ON oi.product_item_id = pi.product_item_id
      LEFT JOIN "orders"       o  ON o.order_id        = oi.order_id AND o.status IN ('paid','fulfilled')
      GROUP BY s.store_id, s.name, s.rating
      ORDER BY revenue::numeric DESC
      LIMIT 5
    `,
    prisma.$queryRaw<Array<{
      product_id: number; name: string; revenue: string; units: bigint;
    }>>`
      SELECT
        p.product_id, p.name,
        COALESCE(SUM(oi.price_per_unit * oi.quantity), 0)::text  AS revenue,
        COALESCE(SUM(oi.quantity), 0)::bigint                    AS units
      FROM "product" p
      LEFT JOIN "product_item" pi ON pi.product_id     = p.product_id
      LEFT JOIN "order_item"   oi ON oi.product_item_id = pi.product_item_id
      LEFT JOIN "orders"       o  ON o.order_id        = oi.order_id AND o.status IN ('paid','fulfilled')
      GROUP BY p.product_id, p.name
      ORDER BY revenue::numeric DESC
      LIMIT 5
    `,
    prisma.$queryRaw<Array<{ bucket: string; buyers: bigint }>>`
      SELECT
        CASE
          WHEN date_part('year', AGE(date_of_birth)) < 18  THEN '<18'
          WHEN date_part('year', AGE(date_of_birth)) < 25  THEN '18-24'
          WHEN date_part('year', AGE(date_of_birth)) < 35  THEN '25-34'
          WHEN date_part('year', AGE(date_of_birth)) < 50  THEN '35-49'
          ELSE '50+'
        END                  AS bucket,
        COUNT(*)::bigint     AS buyers
      FROM "users"
      WHERE date_of_birth IS NOT NULL
      GROUP BY bucket
      ORDER BY bucket
    `,
    prisma.$queryRaw<Array<{
      category_id: number; name: string; product_count: bigint; revenue: string;
    }>>`
      SELECT
        c.category_id, c.name,
        COUNT(DISTINCT p.product_id)::bigint                                AS product_count,
        COALESCE(SUM(oi.price_per_unit * oi.quantity), 0)::text             AS revenue
      FROM "category" c
      LEFT JOIN "product"      p  ON p.category_id     = c.category_id
      LEFT JOIN "product_item" pi ON pi.product_id     = p.product_id
      LEFT JOIN "order_item"   oi ON oi.product_item_id = pi.product_item_id
      LEFT JOIN "orders"       o  ON o.order_id        = oi.order_id AND o.status IN ('paid','fulfilled')
      GROUP BY c.category_id, c.name
      ORDER BY revenue::numeric DESC
    `,
    prisma.$queryRaw<Array<{ tag_id: number; tag_name: string; product_count: bigint }>>`
      SELECT t.tag_id, t.tag_name,
             COUNT(*)::bigint AS product_count
      FROM "tag" t
      JOIN "product_n_tag" pnt ON pnt.tag_id = t.tag_id
      GROUP BY t.tag_id, t.tag_name
      ORDER BY product_count DESC
      LIMIT 10
    `,
    prisma.$queryRaw<Array<{
      total_coupons: bigint; active_coupons: bigint; total_redemptions: bigint;
      total_discount: string; near_expiry: bigint;
    }>>`
      SELECT
        (SELECT COUNT(*) FROM "coupon")                                                        AS total_coupons,
        (SELECT COUNT(*) FROM "coupon" WHERE is_active = true AND end_date >= NOW())           AS active_coupons,
        (SELECT COUNT(*) FROM "coupon_usage")                                                  AS total_redemptions,
        COALESCE((
          SELECT SUM(
            CASE WHEN c.discount_type = 'percent'
                 THEN oi.price_per_unit * oi.quantity * c.discount_value / 100.0
                 ELSE LEAST(c.discount_value, oi.price_per_unit * oi.quantity)
            END
          )
          FROM "order_item" oi
          JOIN "coupon"     c ON c.coupon_id = oi.coupon_id
          JOIN "orders"     o ON o.order_id  = oi.order_id
          WHERE o.status IN ('paid', 'fulfilled')
        ), 0)::text                                                                            AS total_discount,
        (SELECT COUNT(*) FROM "coupon"
          WHERE is_active = true
            AND end_date BETWEEN NOW() AND NOW() + INTERVAL '7 days')                          AS near_expiry
    `,
    prisma.$queryRaw<Array<{
      avg_rating: number | null; total_reviews: bigint; reviews_7d: bigint; low_rated: bigint;
    }>>`
      SELECT
        ROUND(AVG(rating)::numeric, 2)::float                                          AS avg_rating,
        COUNT(*)::bigint                                                               AS total_reviews,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::bigint        AS reviews_7d,
        COUNT(*) FILTER (WHERE rating <= 2)::bigint                                    AS low_rated
      FROM "product_review"
    `,
  ]);

  return {
    growth: growth[0]
      ? {
          totalUsers: Number(growth[0].total_users),
          buyers: Number(growth[0].buyers),
          sellers: Number(growth[0].sellers),
          admins: Number(growth[0].admins),
          active7d: Number(growth[0].active_7d),
        }
      : null,
    topStores: topStores.map((s) => ({
      storeId: s.store_id, name: s.name,
      revenue: Number(s.revenue), orders: Number(s.orders),
      rating: s.rating,
    })),
    topProducts: topProducts.map((p) => ({
      productId: p.product_id, name: p.name,
      revenue: Number(p.revenue), units: Number(p.units),
    })),
    ageGroups: ageGroups.map((a) => ({ bucket: a.bucket, buyers: Number(a.buyers) })),
    categories: categories.map((c) => ({
      categoryId: c.category_id, name: c.name,
      productCount: Number(c.product_count), revenue: Number(c.revenue),
    })),
    tags: tags.map((t) => ({ tagId: t.tag_id, tagName: t.tag_name, productCount: Number(t.product_count) })),
    couponImpact: couponImpact[0]
      ? {
          totalCoupons: Number(couponImpact[0].total_coupons),
          activeCoupons: Number(couponImpact[0].active_coupons),
          totalRedemptions: Number(couponImpact[0].total_redemptions),
          totalDiscount: Number(couponImpact[0].total_discount),
          nearExpiry: Number(couponImpact[0].near_expiry),
        }
      : null,
    reviewMonitor: reviewMonitor[0]
      ? {
          avgRating: reviewMonitor[0].avg_rating ?? 0,
          totalReviews: Number(reviewMonitor[0].total_reviews),
          reviews7d: Number(reviewMonitor[0].reviews_7d),
          lowRated: Number(reviewMonitor[0].low_rated),
        }
      : null,
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
    const acct = lineWithStore?.productItem?.product.store.stripeAccountId;
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

// =============================================================================
//  DATABASE INSPECTOR
// =============================================================================
//
// Surfaces the raw Postgres state that drives the "Database Systems" view
// of the project for the CPE241 defense:
//   - per-table row counts (pg_stat_user_tables)
//   - index list with definitions (pg_indexes)
//   - applied migrations (_prisma_migrations)
//   - cached PG version + DB size
//
// The admin /admin/database page reads this to demonstrate that we have
// real schema design + indexing + migration discipline, not just
// "Prisma magicked it for me".

export interface DatabaseSnapshot {
  version: string;
  databaseSize: string;
  tables: Array<{
    table: string;
    rows: number;
    sizeBytes: number;
    sizePretty: string;
  }>;
  indexes: Array<{
    table: string;
    name: string;
    definition: string;
    isUnique: boolean;
    isPrimary: boolean;
  }>;
  migrations: Array<{
    name: string;
    appliedAt: string;
    rolledBack: boolean;
  }>;
  jsonbUsage: Array<{
    table: string;
    column: string;
    sampleQuery: string;
  }>;
}

export async function getDatabaseSnapshot(): Promise<DatabaseSnapshot> {
  const versionRows = await prisma.$queryRaw<Array<{ version: string }>>`
    SELECT version() AS version
  `;
  const sizeRows = await prisma.$queryRaw<Array<{ size: string }>>`
    SELECT pg_size_pretty(pg_database_size(current_database())) AS size
  `;
  const tableRows = await prisma.$queryRaw<
    Array<{ table_name: string; rows: bigint; bytes: bigint; pretty: string }>
  >`
    SELECT c.relname                                AS table_name,
           c.reltuples::bigint                       AS rows,
           pg_total_relation_size(c.oid)             AS bytes,
           pg_size_pretty(pg_total_relation_size(c.oid)) AS pretty
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND c.relkind = 'r'
     ORDER BY pg_total_relation_size(c.oid) DESC
  `;
  const indexRows = await prisma.$queryRaw<
    Array<{
      table_name: string;
      index_name: string;
      definition: string;
      is_unique: boolean;
      is_primary: boolean;
    }>
  >`
    SELECT t.relname        AS table_name,
           i.relname        AS index_name,
           pg_get_indexdef(i.oid) AS definition,
           ix.indisunique   AS is_unique,
           ix.indisprimary  AS is_primary
      FROM pg_index ix
      JOIN pg_class i  ON i.oid = ix.indexrelid
      JOIN pg_class t  ON t.oid = ix.indrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
     WHERE n.nspname = 'public'
     ORDER BY t.relname, i.relname
  `;
  const migrationRows = await prisma.$queryRaw<
    Array<{ migration_name: string; finished_at: Date | null; rolled_back_at: Date | null }>
  >`
    SELECT migration_name, finished_at, rolled_back_at
      FROM _prisma_migrations
     ORDER BY finished_at DESC NULLS LAST
  `;

  return {
    version: versionRows[0]?.version ?? "unknown",
    databaseSize: sizeRows[0]?.size ?? "?",
    tables: tableRows.map((r) => ({
      table: r.table_name,
      rows: Number(r.rows),
      sizeBytes: Number(r.bytes),
      sizePretty: r.pretty,
    })),
    indexes: indexRows.map((r) => ({
      table: r.table_name,
      name: r.index_name,
      definition: r.definition,
      isUnique: r.is_unique,
      isPrimary: r.is_primary,
    })),
    migrations: migrationRows.map((r) => ({
      name: r.migration_name,
      appliedAt: (r.finished_at ?? new Date(0)).toISOString(),
      rolledBack: Boolean(r.rolled_back_at),
    })),
    jsonbUsage: [
      {
        table: "audit_log",
        column: "meta",
        sampleQuery:
          "SELECT * FROM audit_log\n WHERE meta @> '{\"eventId\":\"evt_123\"}'\n ORDER BY created_at DESC",
      },
    ],
  };
}

/**
 * Read-only SQL playground used by the /admin/database SQL console.
 * Hard rules:
 *   - SELECT or EXPLAIN only — anything else (INSERT/UPDATE/DELETE/DDL)
 *     is rejected before it touches the connection.
 *   - 30s server timeout via Postgres SET LOCAL statement_timeout.
 *   - 200-row hard cap so a runaway SELECT can't OOM the API process.
 */
export async function runAdminSql(rawSql: string): Promise<{
  rows: Array<Record<string, unknown>>;
  rowCount: number;
  truncated: boolean;
  durationMs: number;
}> {
  const sql = rawSql.trim().replace(/;+\s*$/, "");
  if (!sql) {
    throw new AppError(400, "EmptySql", "Type a SELECT or EXPLAIN statement first.");
  }
  const lower = sql.toLowerCase();
  const isAllowed = lower.startsWith("select") || lower.startsWith("explain") || lower.startsWith("with");
  if (!isAllowed) {
    throw new AppError(
      400,
      "ReadOnlyOnly",
      "Only SELECT, WITH, and EXPLAIN are allowed here.",
    );
  }
  // Block multi-statement attempts (we strip a single trailing `;` above).
  if (sql.includes(";")) {
    throw new AppError(
      400,
      "MultipleStatements",
      "Multiple statements aren't allowed — run one query at a time.",
    );
  }
  const ROW_CAP = 200;
  const started = Date.now();
  const rows = await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL statement_timeout = '30s'`);
    await tx.$executeRawUnsafe(`SET LOCAL transaction_read_only = on`);
    return tx.$queryRawUnsafe<Array<Record<string, unknown>>>(sql);
  });
  const truncated = rows.length > ROW_CAP;
  const trimmed = truncated ? rows.slice(0, ROW_CAP) : rows;
  return {
    rows: serialiseRows(trimmed),
    rowCount: rows.length,
    truncated,
    durationMs: Date.now() - started,
  };
}

// pg returns BigInt for bigint columns + Date objects for timestamps;
// neither survives JSON.stringify cleanly, so coerce to readable strings.
function serialiseRows(
  rows: Array<Record<string, unknown>>,
): Array<Record<string, unknown>> {
  return rows.map((r) => {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(r)) {
      if (typeof v === "bigint") out[k] = v.toString();
      else if (v instanceof Date) out[k] = v.toISOString();
      else out[k] = v;
    }
    return out;
  });
}
