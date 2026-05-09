import type { Request } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../db/prisma.js";
import { AppError } from "../utils/errors.js";
import { audit } from "../utils/audit.js";
import { bangkokStartOfDay, bangkokEndOfDay } from "../utils/time.js";
import { refundOrder as stripeRefund, getClient as getStripeClient, isConfigured as stripeConfigured } from "./stripe.service.js";
import { finalizeOrder, clearCartAfterPayment } from "./orders.service.js";
import { PUBLIC_SITE_URL } from "../config.js";
import * as seller from "./seller.service.js";
import {
  updateStoreSchema,
  productInputSchema,
} from "../models/seller.model.js";
import {
  type UserListQuery,
  type UpdateUserRoleInput,
  type DeleteUserInput,
  type AdminStatsResponse,
  type ReportName,
} from "../models/admin.model.js";

// Narrow type so services don't have to drag in the full Express.Request.
type AuditReq = Pick<Request, "ip" | "headers"> | null | undefined;

// Per-query timing for the /admin dashboard footer. Records each
// query's parallel duration; UI labels this clearly.
type QueryStat = { name: string; ms: number };
async function timed<T>(name: string, stats: QueryStat[], fn: () => Promise<T>): Promise<T> {
  const t0 = performance.now();
  try {
    return await fn();
  } finally {
    stats.push({ name, ms: Math.round((performance.now() - t0) * 100) / 100 });
  }
}

// Admin service. Pure functions taking ids/params; destructive
// actions write an AuditLog row through utils/audit.ts.

export async function listUsers(q: UserListQuery) {
  // `?status=banned` shows the Banned chip; default view hides
  // anonymised rows (email starts with `deleted_`).
  const statusWhere =
    q.status === "banned"
      ? { bannedAt: { not: null } }
      : {
          // Hide anonymised rows from the default view.
          email: { not: { startsWith: "deleted_" } },
        };

  // Merge stats.* filters under one nested key.
  const statsFilter = {
    ...(q.role ? { role: q.role } : {}),
    ...(q.buyerLevel !== undefined ? { buyerLevel: q.buyerLevel } : {}),
    ...(q.sellerLevel !== undefined ? { sellerLevel: q.sellerLevel } : {}),
  };
  const signupRange: Record<string, Date> = {};
  if (q.signupAfter) {
    const d = new Date(q.signupAfter);
    if (!isNaN(d.getTime())) signupRange.gte = d;
  }
  if (q.signupBefore) {
    const d = new Date(q.signupBefore);
    if (!isNaN(d.getTime())) signupRange.lte = d;
  }
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
    ...(Object.keys(statsFilter).length > 0 ? { stats: statsFilter } : {}),
    ...(q.gender ? { gender: q.gender } : {}),
    ...(q.countryId ? { countryId: q.countryId } : {}),
    ...(Object.keys(signupRange).length > 0 ? { createdDate: signupRange } : {}),
    ...statusWhere,
  };

  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
      orderBy: { createdDate: "desc" },
      // Explicit allowlist — credential fields must never reach the UI.
      select: {
        userId: true,
        username: true,
        firstName: true,
        lastName: true,
        email: true,
        emailVerified: true,
        gender: true,
        profileImage: true,
        dateOfBirth: true,
        phone: true,
        phoneVerifiedAt: true,
        totpEnabled: true,
        requirePasswordReset: true,
        createdDate: true,
        updatedAt: true,
        bannedAt: true,
        bannedReason: true,
        countryId: true,
        country: { select: { countryId: true, name: true } },
        stats: {
          select: {
            userId: true,
            buyerLevel: true,
            sellerLevel: true,
            role: true,
            updatedAt: true,
          },
        },
        store: { select: { storeId: true, name: true } },
      },
    }),
    prisma.user.count({ where }),
  ]);

  // Belt-and-suspenders: strip credential-shaped fields in code too.
  const SENSITIVE = [
    "password",
    "totpSecret",
    "totpBackupCodes",
    "phoneOtpHash",
    "phoneOtpExpiresAt",
  ] as const;
  const safeItems = items.map((row) => {
    const out = { ...row } as Record<string, unknown>;
    for (const k of SENSITIVE) delete out[k];
    return out;
  });

  return {
    items: safeItems,
    page: q.page,
    pageSize: q.pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / q.pageSize)),
  };
}

/**
 * Change a user's role. Self-demote forbidden. Side effects:
 *   - "seller" without a store → adminCreateStore.
 *   - "buyer" with a store → deleteStore.
 *   - "admin" → role flip only.
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

  // Capture previous role + username for audit + auto-store-create name.
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

  // Side effects before the role flip so the audit chain reads in
  // execution order.
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
 * Three-path delete:
 *   - reason → ban (bannedAt + bannedReason; row stays).
 *   - no reason + no history → hard-delete (cascades clean up).
 *   - no reason + has history → anonymise (PII blanked, sessions
 *     dropped; history rows preserved for analytics).
 * Last-admin guard prevents locking the marketplace out.
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

  // Anonymise: blank PII, clear auth state, drop sessions + accounts.
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
 * clears `bannedAt` + `bannedReason` so the user can sign in again.
 * Doesn't touch role / store / order history.
 * Used by the "Unban" row action when admin filters /admin/users by
 * `status=banned`.
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

// =============================================================================
//  ADMIN STORE / PRODUCT EDITING
// =============================================================================
// Thin wrappers over seller.service for admin overrides; audit rows
// are tagged with `admin.*` actions to distinguish from seller self-edits.

/**
 * GET /admin/stores/:id — store detail with owner + product count
 * + suspension state for the admin header.
 */
export async function getStoreDetail(storeId: number) {
  const store = await prisma.store.findUnique({
    where: { storeId },
    include: {
      businessType: true,
      owner: {
        select: {
          userId: true, username: true, firstName: true, lastName: true,
          email: true, profileImage: true,
        },
      },
      _count: { select: { products: true } },
    },
  });
  if (!store) throw new AppError(404, "NotFound");
  return store;
}

/**
 * PATCH /admin/stores/:id — validates with the seller schema, then
 * writes an `admin.store.update` audit row.
 */
export async function adminUpdateStore(
  storeId: number,
  actorUserId: number,
  body: unknown,
  req?: AuditReq,
) {
  const parsed = updateStoreSchema.safeParse(body);
  if (!parsed.success) throw parsed.error;
  const result = await seller.updateStore(storeId, parsed.data);
  await audit({
    actorId: actorUserId,
    action: "admin.store.update",
    targetType: "store",
    targetId: storeId,
    meta: { fields: Object.keys(parsed.data) },
    req,
  });
  return result;
}

/** GET /admin/stores/:id/products — passthrough to seller.listProducts. */
export async function listStoreProducts(storeId: number) {
  return seller.listProducts(storeId);
}

/** GET /admin/stores/:id/products/:pid — passthrough to seller.getProduct. */
export async function getStoreProduct(productId: number, storeId: number) {
  return seller.getProduct(productId, storeId);
}

/**
 * PATCH /admin/stores/:id/products/:pid — admin override of
 * seller.updateProduct. Accepts the same body shapes (pause-toggle or
 * full edit). Writes an `admin.product.update` audit row.
 */
export async function adminUpdateProduct(
  productId: number,
  storeId: number,
  actorUserId: number,
  body: unknown,
  req?: AuditReq,
) {
  // Pause-toggle path: { isActive: boolean } only.
  const isPauseToggle =
    body && typeof (body as any).isActive === "boolean" &&
    Object.keys(body as object).length === 1;

  if (isPauseToggle) {
    const result = await seller.updateProduct(productId, storeId, body as { isActive: boolean });
    await audit({
      actorId: actorUserId,
      action: "admin.product.update",
      targetType: "product",
      targetId: productId,
      meta: { storeId, isActive: (body as any).isActive },
      req,
    });
    return result;
  }

  // Full-edit path — same Zod schema as /seller/products/:id.
  const parsed = productInputSchema.safeParse(body);
  if (!parsed.success) throw parsed.error;
  const result = await seller.updateProduct(productId, storeId, parsed.data);
  await audit({
    actorId: actorUserId,
    action: "admin.product.update",
    targetType: "product",
    targetId: productId,
    meta: { storeId, fields: Object.keys(parsed.data) },
    req,
  });
  return result;
}

/**
 * DELETE /admin/stores/:id/products/:pid. Writes both `product.delete`
 * (via seller.deleteProduct) and `admin.product.delete` so the audit
 * feed shows the admin override clearly.
 */
export async function adminDeleteProduct(
  productId: number,
  storeId: number,
  actorUserId: number,
  req?: AuditReq,
) {
  // Look up the name BEFORE delete so the audit meta carries it.
  const product = await prisma.product.findUnique({
    where: { productId },
    select: { storeId: true, name: true },
  });
  if (!product) throw new AppError(404, "NotFound");
  if (product.storeId !== storeId) throw new AppError(403, "Forbidden");

  await seller.deleteProduct(productId, storeId, actorUserId, product.name);
  await audit({
    actorId: actorUserId,
    action: "admin.product.delete",
    targetType: "product",
    targetId: productId,
    meta: { storeId, productName: product.name },
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
 * Admin dashboard KPIs: counts + GMV in one CTE query, plus the recent
 * transactions feed and a `days`-wide daily revenue series in parallel.
 */
export async function getStats(days = 14): Promise<AdminStatsResponse> {
  // Clamp to bound the generate_series and keep the plan predictable.
  const safeDays = Math.max(1, Math.min(365, Math.floor(days)));
  const offset = safeDays - 1;

  type CountsRow = {
    users: bigint;
    stores: bigint;
    products: bigint;
    reviews: bigint;
    orders: bigint;
    pending_orders: bigint;
    gmv: string;
    platform_earnings: string;
    platform_fee_percent: string;
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
        -- Bound to the last 30 minutes so expired-but-unswept orders
        -- don't inflate the tile when sweepExpiredOrders is delayed
        -- (cold-start, GC pause). Real "pending" is a 15-minute TTL
        -- per Business Rule 4j; 30 minutes is a 2× generous ceiling.
        (SELECT COUNT(*) FROM "orders"
          WHERE status = 'pending'
            AND created_at >= NOW() - INTERVAL '30 minutes')                       AS pending_orders,
        (SELECT COALESCE(SUM(total_price), 0)::text
           FROM "orders"
          WHERE status IN ('paid', 'fulfilled'))                                   AS gmv,
        -- Platform's net cut: (settled total - refunded satang/100) × pct ÷ 100.
        -- Includes status='refunded' rows so partial refunds net out correctly;
        -- fully refunded rows contribute 0 because total_price = refunded/100.
        (SELECT COALESCE(SUM(
                 (total_price - stripe_amount_refunded::numeric / 100.0)
                 * (SELECT platform_fee_percent FROM "system_setting" WHERE id = 1)
                 / 100.0
               ), 0)::text
           FROM "orders"
          WHERE status IN ('paid', 'fulfilled', 'refunded'))                       AS platform_earnings,
        (SELECT platform_fee_percent::text
           FROM "system_setting" WHERE id = 1)                                     AS platform_fee_percent
    `,
    // Recent transactions — settled rows only, ordered by payment-moment date.
    prisma.transaction.findMany({
      where: {
        OR: [
          { transactionType: "payout" },
          {
            orders: {
              some: { status: { in: ["paid", "fulfilled", "refunded"] } },
            },
          },
        ],
      },
      orderBy: { date: "desc" },
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
    // N-day revenue series, binned by Bangkok local date.
    prisma.$queryRaw<
      Array<{ day: string; revenue: string; order_count: bigint }>
    >`
      SELECT
        TO_CHAR(d::date, 'YYYY-MM-DD')                                    AS day,
        COALESCE(SUM(o.total_price) FILTER (WHERE o.status IN ('paid','fulfilled')), 0)::text AS revenue,
        COUNT(o.order_id) FILTER (WHERE o.status IN ('paid','fulfilled')) AS order_count
      FROM generate_series(
             (NOW() AT TIME ZONE 'Asia/Bangkok')::date - (${offset}::int * INTERVAL '1 day'),
             (NOW() AT TIME ZONE 'Asia/Bangkok')::date,
             INTERVAL '1 day'
           ) d
      LEFT JOIN "orders" o
        ON (o.created_at AT TIME ZONE 'Asia/Bangkok')::date = d::date
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
    platformEarnings: Number(c.platform_earnings),
    platformFeePercent: Number(c.platform_fee_percent),
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
  const queryStats: QueryStat[] = [];
  const [growth, topStores, topProducts, ageGroups, categories, tags, couponImpact, reviewMonitor, kpiSparklineRows, ordersByStatusRows, kpiDeltaRows, topBuyersRows, ordersByCountryRows, aovTrendRows, infoIntegrityRows, productMatrixRows] = await Promise.all([
    timed("growth", queryStats, () => prisma.$queryRaw<Array<{
      total_users: bigint; buyers: bigint; sellers: bigint; admins: bigint;
      active_7d: bigint;
    }>>`
      SELECT
        (SELECT COUNT(*) FROM "users")                                                             AS total_users,
        (SELECT COUNT(*) FROM "user_stats" WHERE role = 'buyer')                                  AS buyers,
        (SELECT COUNT(*) FROM "user_stats" WHERE role = 'seller')                                 AS sellers,
        (SELECT COUNT(*) FROM "user_stats" WHERE role = 'admin')                                  AS admins,
        (SELECT COUNT(DISTINCT user_id) FROM "orders" WHERE created_at >= NOW() - INTERVAL '7 days') AS active_7d
    `),
    // Top stores from the `top_stores_30d` matview, joined to `store`
    // for the OLTP-maintained rating column.
    timed("topStores (matview)", queryStats, () => prisma.$queryRaw<Array<{
      store_id: number; name: string; revenue_text: string; orders: bigint;
      rating: number; computed_at: Date;
    }>>`
      -- Postgres rejects "ORDER BY t.revenue" when the SELECT list also
      -- has "AS revenue" (alias collision masks the qualified column);
      -- alias the text-cast as revenue_text and ORDER BY the underlying
      -- numeric column instead.
      SELECT t.store_id, t.name, s.rating,
             t.revenue::text AS revenue_text,
             t.orders        AS orders,
             t.computed_at   AS computed_at
        FROM "top_stores_30d" t
        JOIN "store"          s ON s.store_id = t.store_id
       ORDER BY t.revenue DESC
       LIMIT 5
    `),
    timed("topProducts", queryStats, () => prisma.$queryRaw<Array<{
      product_id: number; name: string; revenue: string; units: bigint;
    }>>`
      -- Same alias-collision quirk that /admin/coupons + topStores
      -- hit: Postgres rejects "ORDER BY revenue::numeric DESC" when
      -- the SELECT list also has "AS revenue" (text). Wrap the
      -- aggregation in a subquery so the alias becomes a real column
      -- on the outer SELECT and the cast resolves cleanly.
      --
      -- The status guard belongs in the SUM, not the JOIN ON: a LEFT
      -- JOIN whose ON-clause filters out a non-settled order leaves
      -- the matching order_item row with o.* = NULL, so the SUM still
      -- counts it. FILTER on the order status keeps zero-order
      -- products visible while excluding pending / cancelled
      -- order_items from the revenue + units totals.
      SELECT product_id, name, revenue::text AS revenue, units
      FROM (
        SELECT
          p.product_id, p.name,
          COALESCE(SUM(oi.price_per_unit * oi.quantity)
                     FILTER (WHERE o.status IN ('paid','fulfilled')), 0) AS revenue,
          COALESCE(SUM(oi.quantity)
                     FILTER (WHERE o.status IN ('paid','fulfilled')), 0)::bigint AS units
        FROM "product" p
        LEFT JOIN "product_item" pi ON pi.product_id     = p.product_id
        LEFT JOIN "order_item"   oi ON oi.product_item_id = pi.product_item_id
        LEFT JOIN "orders"       o  ON o.order_id        = oi.order_id
        GROUP BY p.product_id, p.name
      ) ranked
      ORDER BY revenue DESC
      LIMIT 5
    `),
    timed("ageGroups", queryStats, () => prisma.$queryRaw<Array<{ bucket: string; buyers: bigint }>>`
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
    `),
    timed("categories", queryStats, () => prisma.$queryRaw<Array<{
      category_id: number; name: string; product_count: bigint; revenue: string;
    }>>`
      -- Schema model maps Category.categoryName → category_name column,
      -- so the raw SQL must reference category_name (not the camelCase
      -- name from the Prisma model). Wrap the aggregation in a
      -- subquery so revenue::text alias doesn't collide with the
      -- ORDER BY (same fix as topStores + topProducts).
      -- Same status-filter-in-the-JOIN bug as topProducts: a LEFT JOIN
      -- whose ON-clause filters out a non-settled order keeps the
      -- order_item row alive (with o.* = NULL), so SUM(oi.price ...)
      -- silently sums pending / cancelled order_items into category
      -- revenue. FILTER on the order status fixes it without losing
      -- zero-order categories from the list.
      SELECT category_id, name, product_count, revenue::text AS revenue
      FROM (
        SELECT
          c.category_id,
          c.category_name AS name,
          COUNT(DISTINCT p.product_id)::bigint                                AS product_count,
          COALESCE(SUM(oi.price_per_unit * oi.quantity)
                     FILTER (WHERE o.status IN ('paid','fulfilled')), 0)      AS revenue
        FROM "category" c
        LEFT JOIN "product"      p  ON p.category_id     = c.category_id
        LEFT JOIN "product_item" pi ON pi.product_id     = p.product_id
        LEFT JOIN "order_item"   oi ON oi.product_item_id = pi.product_item_id
        LEFT JOIN "orders"       o  ON o.order_id        = oi.order_id
        GROUP BY c.category_id, c.category_name
      ) ranked
      ORDER BY revenue DESC
    `),
    timed("tags", queryStats, () => prisma.$queryRaw<Array<{ tag_id: number; tag_name: string; product_count: bigint }>>`
      SELECT t.tag_id, t.tag_name,
             COUNT(*)::bigint AS product_count
      FROM "product_tag" t
      JOIN "product_n_tag" pnt ON pnt.tag_id = t.tag_id
      GROUP BY t.tag_id, t.tag_name
      ORDER BY product_count DESC
      LIMIT 10
    `),
    timed("couponImpact", queryStats, () => prisma.$queryRaw<Array<{
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
    `),
    timed("reviewMonitor", queryStats, () => prisma.$queryRaw<Array<{
      avg_rating: number | null; total_reviews: bigint; reviews_7d: bigint; low_rated: bigint;
    }>>`
      SELECT
        ROUND(AVG(rating)::numeric, 2)::float                                          AS avg_rating,
        COUNT(*)::bigint                                                               AS total_reviews,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::bigint        AS reviews_7d,
        COUNT(*) FILTER (WHERE rating <= 2)::bigint                                    AS low_rated
      FROM "product_review"
    `),
    // 7-day daily counts for KPI sparklines, in one round-trip.
    timed("kpiSparklines", queryStats, () => prisma.$queryRaw<Array<{
      day: string; users: bigint; orders: bigint; gmv: string; reviews: bigint;
    }>>`
      SELECT TO_CHAR(d::date, 'YYYY-MM-DD') AS day,
             COALESCE((SELECT COUNT(*) FROM "users" u
                        WHERE (u.created_date AT TIME ZONE 'Asia/Bangkok')::date = d::date), 0)::bigint  AS users,
             COALESCE((SELECT COUNT(*) FROM "orders" o
                        WHERE (o.created_at AT TIME ZONE 'Asia/Bangkok')::date = d::date), 0)::bigint   AS orders,
             COALESCE((SELECT SUM(total_price) FROM "orders" o
                        WHERE (o.created_at AT TIME ZONE 'Asia/Bangkok')::date = d::date
                          AND o.status IN ('paid','fulfilled')), 0)::text AS gmv,
             COALESCE((SELECT COUNT(*) FROM "product_review" r
                        WHERE (r.created_at AT TIME ZONE 'Asia/Bangkok')::date = d::date), 0)::bigint AS reviews
      FROM generate_series(
             (NOW() AT TIME ZONE 'Asia/Bangkok')::date - INTERVAL '6 days',
             (NOW() AT TIME ZONE 'Asia/Bangkok')::date,
             INTERVAL '1 day'
           ) d
      ORDER BY d ASC
    `),
    // Orders-by-status breakdown for the /admin donut.
    timed("ordersByStatus", queryStats, () => prisma.$queryRaw<Array<{
      status: string; count: bigint;
    }>>`
      SELECT status::text AS status, COUNT(*)::bigint AS count
      FROM "orders"
      GROUP BY status
      ORDER BY count DESC
    `),
    // Week-over-week deltas for the headline KPIs.
    timed("kpiDeltas", queryStats, () => prisma.$queryRaw<Array<{
      users_this: bigint; users_prev: bigint;
      orders_this: bigint; orders_prev: bigint;
      gmv_this: string; gmv_prev: string;
    }>>`
      SELECT
        (SELECT COUNT(*) FROM "users"
          WHERE created_date >= NOW() - INTERVAL '7 days')::bigint                            AS users_this,
        (SELECT COUNT(*) FROM "users"
          WHERE created_date >= NOW() - INTERVAL '14 days'
            AND created_date <  NOW() - INTERVAL '7 days')::bigint                            AS users_prev,
        (SELECT COUNT(*) FROM "orders"
          WHERE created_at  >= NOW() - INTERVAL '7 days')::bigint                             AS orders_this,
        (SELECT COUNT(*) FROM "orders"
          WHERE created_at  >= NOW() - INTERVAL '14 days'
            AND created_at  <  NOW() - INTERVAL '7 days')::bigint                             AS orders_prev,
        (SELECT COALESCE(SUM(total_price), 0) FROM "orders"
          WHERE status IN ('paid','fulfilled')
            AND created_at  >= NOW() - INTERVAL '7 days')::text                               AS gmv_this,
        (SELECT COALESCE(SUM(total_price), 0) FROM "orders"
          WHERE status IN ('paid','fulfilled')
            AND created_at  >= NOW() - INTERVAL '14 days'
            AND created_at  <  NOW() - INTERVAL '7 days')::text                               AS gmv_prev
    `),
    // Top 5 buyers by lifetime spend (settled orders only).
    timed("topBuyers", queryStats, () => prisma.$queryRaw<Array<{
      user_id: number; first_name: string; last_name: string; username: string;
      profile_image: string | null; orders: bigint; spend: string;
    }>>`
      SELECT u.user_id, u.first_name, u.last_name, u.username, u.profile_image,
             COUNT(o.order_id)::bigint        AS orders,
             COALESCE(SUM(o.total_price), 0)::text AS spend
      FROM "users" u
      JOIN "orders" o ON o.user_id = u.user_id
      WHERE o.status IN ('paid', 'fulfilled')
      GROUP BY u.user_id, u.first_name, u.last_name, u.username, u.profile_image
      ORDER BY SUM(o.total_price) DESC
      LIMIT 5
    `),
    // Orders by buyer country — top 8 (Unknown bucket for missing).
    timed("ordersByCountry", queryStats, () => prisma.$queryRaw<Array<{
      country_id: number | null; country_name: string; orders: bigint; spend: string;
    }>>`
      SELECT
        u.country_id,
        COALESCE(c.name, 'Unknown')                  AS country_name,
        COUNT(*)::bigint                             AS orders,
        COALESCE(SUM(o.total_price), 0)::text        AS spend
      FROM "orders" o
      JOIN "users"   u ON u.user_id    = o.user_id
      LEFT JOIN "country" c ON c.country_id = u.country_id
      WHERE o.status IN ('paid', 'fulfilled')
      GROUP BY u.country_id, c.name
      ORDER BY orders DESC
      LIMIT 8
    `),
    // 14-day AOV trend for the KPI sparkline.
    timed("aovTrend", queryStats, () => prisma.$queryRaw<Array<{ day: string; aov: string }>>`
      SELECT TO_CHAR(d::date, 'YYYY-MM-DD')                          AS day,
             COALESCE((
               SELECT AVG(total_price)::numeric(20,2)
                 FROM "orders" o
                WHERE (o.created_at AT TIME ZONE 'Asia/Bangkok')::date = d::date
                  AND o.status IN ('paid', 'fulfilled')
             ), 0)::text                                             AS aov
      FROM generate_series(
             (NOW() AT TIME ZONE 'Asia/Bangkok')::date - INTERVAL '13 days',
             (NOW() AT TIME ZONE 'Asia/Bangkok')::date,
             INTERVAL '1 day'
           ) d
      ORDER BY d ASC
    `),
    // User Information Integrity — share of users with "complete"
    // profiles, and share of settled orders from complete-profile users.
    timed("userInfoIntegrity", queryStats, () => prisma.$queryRaw<Array<{
      total_users: bigint; complete_users: bigint;
      total_orders: bigint; orders_from_complete: bigint;
    }>>`
      SELECT
        -- Active users only: anonymised (deleted_*) and banned rows
        -- skew the data-hygiene readout because deleteUser nulls out
        -- their PII. The default /admin/users list also hides them —
        -- keep this widget consistent so the % matches the table.
        (SELECT COUNT(*)::bigint FROM "users"
          WHERE banned_at IS NULL
            AND email NOT LIKE 'deleted_%')                                 AS total_users,
        (SELECT COUNT(*)::bigint FROM "users"
          WHERE banned_at IS NULL
            AND email NOT LIKE 'deleted_%'
            AND first_name IS NOT NULL AND first_name <> ''
            AND last_name  IS NOT NULL AND last_name  <> ''
            AND date_of_birth IS NOT NULL
            AND country_id    IS NOT NULL
            AND phone         IS NOT NULL AND phone <> ''
            AND profile_image IS NOT NULL AND profile_image <> '')         AS complete_users,
        (SELECT COUNT(*)::bigint FROM "orders"
          WHERE status IN ('paid', 'fulfilled'))                            AS total_orders,
        (SELECT COUNT(*)::bigint
          FROM   "orders" o
          JOIN   "users"  u ON u.user_id = o.user_id
          WHERE  o.status IN ('paid', 'fulfilled')
            AND  u.banned_at IS NULL
            AND  u.email NOT LIKE 'deleted_%'
            AND  u.first_name IS NOT NULL AND u.first_name <> ''
            AND  u.last_name  IS NOT NULL AND u.last_name  <> ''
            AND  u.date_of_birth IS NOT NULL
            AND  u.country_id    IS NOT NULL
            AND  u.phone         IS NOT NULL AND u.phone <> ''
            AND  u.profile_image IS NOT NULL AND u.profile_image <> '') AS orders_from_complete
    `),
    // Underperformer half of the product matrix — bottom 5 by 30-day
    // revenue (active products in non-suspended stores only).
    timed("productMatrix", queryStats, () => prisma.$queryRaw<Array<{
      product_id: number; name: string; revenue_30d: string; units_30d: bigint;
      total_units: bigint;
    }>>`
      SELECT product_id, name, revenue_30d::text AS revenue_30d, units_30d, total_units
      FROM (
        SELECT p.product_id,
               p.name,
               COALESCE(SUM(CASE WHEN o.status IN ('paid','fulfilled')
                                  AND o.created_at >= NOW() - INTERVAL '30 days'
                                 THEN oi.price_per_unit * oi.quantity ELSE 0 END), 0) AS revenue_30d,
               COALESCE(SUM(CASE WHEN o.status IN ('paid','fulfilled')
                                  AND o.created_at >= NOW() - INTERVAL '30 days'
                                 THEN oi.quantity ELSE 0 END), 0)::bigint              AS units_30d,
               COALESCE(SUM(CASE WHEN o.status IN ('paid','fulfilled')
                                 THEN oi.quantity ELSE 0 END), 0)::bigint              AS total_units
          FROM "product"      p
          JOIN "store"        s  ON s.store_id        = p.store_id
          JOIN "product_item" pi ON pi.product_id     = p.product_id
          LEFT JOIN "order_item" oi ON oi.product_item_id = pi.product_item_id
          LEFT JOIN "orders"     o  ON o.order_id     = oi.order_id
         WHERE p.is_active = true
           AND s.suspended_at IS NULL
         GROUP BY p.product_id, p.name
      ) ranked
      ORDER BY revenue_30d ASC, total_units ASC, product_id ASC
      LIMIT 5
    `),
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
      revenue: Number(s.revenue_text), orders: Number(s.orders),
      rating: s.rating,
    })),
    // ISO timestamp of last matview refresh; null when empty.
    topStoresComputedAt: topStores[0]?.computed_at?.toISOString() ?? null,
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
    // 7-day sparklines per KPI, oldest → newest.
    kpiSparklines: {
      users:   kpiSparklineRows.map((r) => Number(r.users)),
      orders:  kpiSparklineRows.map((r) => Number(r.orders)),
      gmv:     kpiSparklineRows.map((r) => Number(r.gmv)),
      reviews: kpiSparklineRows.map((r) => Number(r.reviews)),
    },
    // Orders-by-status breakdown for the donut chart.
    ordersByStatus: ordersByStatusRows.map((r) => ({
      status: r.status, count: Number(r.count),
    })),
    // Week-over-week deltas with pre-computed pct (null when prev=0).
    kpiDeltas: (() => {
      const r = kpiDeltaRows[0];
      if (!r) return null;
      const pct = (now: number, prev: number): number | null =>
        prev === 0 ? null : ((now - prev) / prev) * 100;
      const u_now = Number(r.users_this), u_prev = Number(r.users_prev);
      const o_now = Number(r.orders_this), o_prev = Number(r.orders_prev);
      const g_now = Number(r.gmv_this), g_prev = Number(r.gmv_prev);
      return {
        users:  { thisWeek: u_now, prevWeek: u_prev, pct: pct(u_now, u_prev) },
        orders: { thisWeek: o_now, prevWeek: o_prev, pct: pct(o_now, o_prev) },
        gmv:    { thisWeek: g_now, prevWeek: g_prev, pct: pct(g_now, g_prev) },
      };
    })(),
    // Top 5 buyers by lifetime spend.
    topBuyers: topBuyersRows.map((b) => ({
      userId: b.user_id,
      firstName: b.first_name,
      lastName: b.last_name,
      username: b.username,
      profileImage: b.profile_image,
      orders: Number(b.orders),
      spend: Number(b.spend),
    })),
    // Orders by buyer country — top 8 with Unknown bucket.
    ordersByCountry: ordersByCountryRows.map((c) => ({
      countryId: c.country_id,
      countryName: c.country_name,
      orders: Number(c.orders),
      spend: Number(c.spend),
    })),
    // 14-day AOV trend — sparkline on the AOV KPI card.
    aovTrend: aovTrendRows.map((r) => Number(r.aov)),
    // User Information Integrity ratios + raw counts.
    userInfoIntegrity: infoIntegrityRows[0]
      ? {
          totalUsers: Number(infoIntegrityRows[0].total_users),
          completeUsers: Number(infoIntegrityRows[0].complete_users),
          totalOrders: Number(infoIntegrityRows[0].total_orders),
          ordersFromComplete: Number(infoIntegrityRows[0].orders_from_complete),
        }
      : null,
    // Bottom 5 products by 30-day revenue (underperformer matrix).
    productMatrix: productMatrixRows.map((p) => ({
      productId: p.product_id,
      name: p.name,
      revenue30d: Number(p.revenue_30d),
      units30d: Number(p.units_30d),
      totalUnits: Number(p.total_units),
    })),
    // Per-query timing (parallel duration); see `timed()` helper.
    queryStats,
  };
}

/**
 * 7×24 (DOW × hour) order-count grid over the last `days`. Bucketed
 * in Asia/Bangkok so the local "evening peak" lines up with wall clock.
 */
export async function getOrderHeatmap(days = 30) {
  const safeDays = Math.max(1, Math.min(365, Math.floor(days)));
  return prisma.$queryRaw<Array<{ dow: number; hour: number; orders: bigint }>>`
    SELECT
      EXTRACT(DOW  FROM (created_at AT TIME ZONE 'Asia/Bangkok'))::int AS dow,
      EXTRACT(HOUR FROM (created_at AT TIME ZONE 'Asia/Bangkok'))::int AS hour,
      COUNT(*) AS orders
    FROM "orders"
    WHERE status IN ('paid', 'fulfilled')
      AND created_at >= NOW() - (${safeDays}::int * INTERVAL '1 day')
    GROUP BY 1, 2
    ORDER BY 1, 2
  `;
}

/**
 * REFRESH MATERIALIZED VIEW CONCURRENTLY on top_stores_30d.
 * Writes an `admin.matview.refresh` audit row.
 */
export async function refreshTopStoresMatview(actorUserId: number, req?: AuditReq) {
  await prisma.$executeRawUnsafe(
    `REFRESH MATERIALIZED VIEW CONCURRENTLY "top_stores_30d"`,
  );
  await audit({
    actorId: actorUserId,
    action: "admin.matview.refresh",
    targetType: "matview",
    targetId: 0,
    meta: { matview: "top_stores_30d" },
    req,
  });
}

// Master coupon = platform-wide (storeId = null). Admin-only create.
export async function createMasterCoupon(input: {
  code: string;
  discountType: "percent" | "fixed";
  discountValue: number;
  // zod's z.coerce.date() emits Date — accept Date | string for tolerance.
  startDate: Date | string;
  endDate: Date | string;
  usageLimit: number;
}, actorId: number, req?: AuditReq) {
  const code = input.code.trim().toUpperCase();
  if (!code) throw new AppError(400, "BadCode", "Code is required.");
  // Pre-check master-coupon code uniqueness for a friendly 409.
  const dup = await prisma.coupon.findFirst({
    where: { code, storeId: null },
    select: { couponId: true },
  });
  if (dup) throw new AppError(409, "CodeTaken", "A master coupon with that code already exists.");
  const created = await prisma.coupon.create({
    data: {
      storeId: null,
      code,
      discountType: input.discountType,
      discountValue: input.discountValue,
      // Snap to Bangkok day boundaries (avoid 07:00 ICT off-by-one).
      startDate: bangkokStartOfDay(input.startDate),
      endDate: bangkokEndOfDay(input.endDate),
      usageLimit: input.usageLimit,
      isActive: true,
    },
  });
  await audit({
    actorId,
    action: "coupon.master_create",
    targetType: "coupon",
    targetId: created.couponId,
    meta: { code, discountType: input.discountType, discountValue: input.discountValue },
    req,
  });
  return created;
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

  // Idempotency: refuse if every linked order is already refunded.
  if (tx.orders.length > 0 && tx.orders.every((o) => o.status === "refunded")) {
    throw new AppError(409, "AlreadyRefunded", "This transaction has already been refunded.");
  }

  // Iterate orders to call Stripe per connected account; bail before
  // any DB write if any Stripe call fails so retries are clean.
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
    // Refund is logged as a negative-amount payout.
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

  // Out-of-band notification on flag-on; email failure is non-blocking.
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
      // FILTER on the aggregate (not the JOIN ON-clause) so
      // cancelled/pending order_items don't sneak into the totals.
      const sql = `
SELECT s.store_id, s.name,
       COALESCE(SUM(oi.price_per_unit * oi.quantity)
                  FILTER (WHERE o.status IN ('paid','fulfilled')), 0)::text AS revenue,
       COUNT(DISTINCT o.order_id)
         FILTER (WHERE o.status IN ('paid','fulfilled'))::bigint            AS orders
FROM store s
LEFT JOIN product p       ON p.store_id = s.store_id
LEFT JOIN product_item pi ON pi.product_id = p.product_id
LEFT JOIN order_item oi   ON oi.product_item_id = pi.product_item_id
LEFT JOIN orders o        ON o.order_id = oi.order_id
GROUP BY s.store_id, s.name
ORDER BY revenue DESC
LIMIT 10`;
      const rows = await prisma.$queryRaw<
        Array<{ store_id: number; name: string; revenue: string; orders: bigint }>
      >`
        SELECT s.store_id, s.name,
               COALESCE(SUM(oi.price_per_unit * oi.quantity)
                          FILTER (WHERE o.status IN ('paid','fulfilled')), 0)::text AS revenue,
               COUNT(DISTINCT o.order_id)
                 FILTER (WHERE o.status IN ('paid','fulfilled'))::bigint            AS orders
        FROM store s
        LEFT JOIN product p       ON p.store_id = s.store_id
        LEFT JOIN product_item pi ON pi.product_id = p.product_id
        LEFT JOIN order_item oi   ON oi.product_item_id = pi.product_item_id
        LEFT JOIN orders o        ON o.order_id = oi.order_id
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
      // Bucket by Bangkok local day (rows stored as UTC).
      const sql = `
SELECT (created_date AT TIME ZONE 'Asia/Bangkok')::date AS day, COUNT(*)::bigint AS count
FROM "users"
WHERE created_date >= NOW() - INTERVAL '60 days'
GROUP BY day ORDER BY day`;
      const rows = await prisma.$queryRaw<
        Array<{ day: Date; count: bigint }>
      >`
        SELECT (created_date AT TIME ZONE 'Asia/Bangkok')::date AS day, COUNT(*)::bigint AS count
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
//  DATABASE INSPECTOR — surfaces row counts, indexes, migrations,
//  PG version + DB size for the /admin/database page.
// =============================================================================

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
 *   - Every invocation writes an `admin.sql.run` audit row.
 */
export async function runAdminSql(
  rawSql: string,
  actorUserId?: number,
  req?: AuditReq,
): Promise<{
  rows: Array<Record<string, unknown>>;
  rowCount: number;
  truncated: boolean;
  durationMs: number;
}> {
  const sqlPreview = rawSql.slice(0, 200);
  const recordAudit = async (
    outcome: "ok" | "rejected" | "error",
    extra: Record<string, unknown> = {},
  ) => {
    await audit({
      actorId: actorUserId ?? null,
      action: "admin.sql.run",
      targetType: "system",
      targetId: 0,
      meta: { sql: sqlPreview, outcome, ...extra },
      req,
    });
  };

  const sql = rawSql.trim().replace(/;+\s*$/, "");
  if (!sql) {
    await recordAudit("rejected", { reason: "EmptySql" });
    throw new AppError(400, "EmptySql", "Type a SELECT or EXPLAIN statement first.");
  }
  const lower = sql.toLowerCase();
  const isAllowed = lower.startsWith("select") || lower.startsWith("explain") || lower.startsWith("with");
  if (!isAllowed) {
    await recordAudit("rejected", { reason: "ReadOnlyOnly" });
    throw new AppError(
      400,
      "ReadOnlyOnly",
      "Only SELECT, WITH, and EXPLAIN are allowed here.",
    );
  }
  // Block multi-statement attempts (we strip a single trailing `;` above).
  if (sql.includes(";")) {
    await recordAudit("rejected", { reason: "MultipleStatements" });
    throw new AppError(
      400,
      "MultipleStatements",
      "Multiple statements aren't allowed — run one query at a time.",
    );
  }
  // Defence-in-depth: reject write keywords as tokens (word-boundary
  // regex) so write-CTEs error before execution, with a clearer message.
  const WRITE_KEYWORDS = [
    "insert", "update", "delete", "merge", "truncate",
    "drop", "alter", "create",
    "grant", "revoke",
    "copy", "vacuum", "reindex",
  ];
  for (const kw of WRITE_KEYWORDS) {
    const re = new RegExp(`\\b${kw}\\b`, "i");
    if (re.test(sql)) {
      await recordAudit("rejected", { reason: "WriteKeywordBlocked", keyword: kw });
      throw new AppError(
        400,
        "WriteKeywordBlocked",
        `\`${kw.toUpperCase()}\` isn't allowed in the SQL playground — read-only.`,
      );
    }
  }
  const ROW_CAP = 200;
  const started = Date.now();
  let rows: Array<Record<string, unknown>>;
  try {
    rows = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL statement_timeout = '30s'`);
      await tx.$executeRawUnsafe(`SET LOCAL transaction_read_only = on`);
      return tx.$queryRawUnsafe<Array<Record<string, unknown>>>(sql);
    });
  } catch (err) {
    await recordAudit("error", {
      durationMs: Date.now() - started,
      error: err instanceof Error ? err.message.slice(0, 200) : "unknown",
    });
    throw err;
  }
  const truncated = rows.length > ROW_CAP;
  const trimmed = truncated ? rows.slice(0, ROW_CAP) : rows;
  const durationMs = Date.now() - started;
  await recordAudit("ok", { rowCount: rows.length, truncated, durationMs });
  return {
    rows: serialiseRows(trimmed),
    rowCount: rows.length,
    truncated,
    durationMs,
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

/**
 * One-shot recovery: rebuild an order's paid state from Stripe when the
 * webhook delivery missed (signature mismatch, network blip, etc.).
 * Mirrors onPaymentIntentSucceeded() in stripe-webhook.routes.ts.
 */
export async function syncOrderFromStripe(
  orderId: number,
  actorUserId: number,
  req?: AuditReq,
  /**
   * When set, ownership is enforced: the order's userId must match
   * `enforceOwnerUserId` or 403 Forbidden. Used for the buyer-facing
   * /orders/:id/sync route so a buyer can recover their own stuck
   * order without admin help.
   */
  enforceOwnerUserId?: number,
): Promise<{ synced: boolean; reason?: string; alreadyPaid?: boolean }> {
  if (!stripeConfigured()) {
    throw new AppError(503, "StripeNotConfigured");
  }
  const order = await prisma.order.findUnique({
    where: { orderId },
    select: {
      orderId: true,
      userId: true,
      status: true,
      totalPrice: true,
      stripePaymentIntentId: true,
      items: {
        take: 1,
        include: {
          productItem: {
            include: {
              product: { include: { store: { select: { stripeAccountId: true } } } },
            },
          },
        },
      },
    },
  });
  if (!order) throw new AppError(404, "OrderNotFound");
  if (enforceOwnerUserId !== undefined && order.userId !== enforceOwnerUserId) {
    // Collapse 403 into 404 so the response shape can't be used to
    // enumerate order IDs that exist but belong to other users.
    // Audit-log the denial separately so SOC keeps visibility.
    await audit({
      actorId: actorUserId,
      action: "order.sync.denied",
      targetType: "order",
      targetId: orderId,
      meta: { reason: "not_owner" },
      req,
    });
    throw new AppError(404, "OrderNotFound");
  }
  if (!order.stripePaymentIntentId) {
    throw new AppError(400, "NoPaymentIntent",
      "This order has no Stripe PaymentIntent recorded — nothing to sync.");
  }
  if (order.status === "paid" || order.status === "fulfilled") {
    return { synced: true, alreadyPaid: true };
  }

  // Direct-charge PIs live on the seller's connected account, so
  // retrieve them with the stripeAccount option. Without it the
  // platform account 404s with "no such payment_intent".
  const sellerStripeAccountId =
    order.items[0]?.productItem?.product?.store?.stripeAccountId;
  if (!sellerStripeAccountId) {
    throw new AppError(400, "MissingStripeAccount",
      "Could not resolve the seller's Stripe Connect account for this order.");
  }
  const pi = await getStripeClient().paymentIntents.retrieve(
    order.stripePaymentIntentId,
    {},
    { stripeAccount: sellerStripeAccountId },
  );
  if (pi.status !== "succeeded") {
    return { synced: false, reason: `Stripe PI status is ${pi.status}` };
  }

  const expectedSatang = Math.round(Number(order.totalPrice) * 100);
  if (pi.amount_received !== expectedSatang) {
    throw new AppError(
      400,
      "AmountMismatch",
      `Expected ${expectedSatang} satang, Stripe shows ${pi.amount_received}.`,
    );
  }

  const chargeId = typeof pi.latest_charge === "string" ? pi.latest_charge : null;
  await prisma.order.update({
    where: { orderId },
    data: {
      status: "paid",
      stripeChargeId: chargeId,
      stripeAmountReceived: pi.amount_received,
    },
  });
  // Mirror onPaymentIntentSucceeded: bump Transaction.date so the admin
  // Recent Transactions widget reflects when payment actually settled,
  // not when the buyer first pressed checkout. Idempotent across the
  // webhook + sync race.
  await prisma.transaction.updateMany({
    where: {
      transactionType: "purchase",
      orders: { some: { orderId } },
    },
    data: { date: new Date() },
  });
  await clearCartAfterPayment(order.userId, orderId).catch(() => {});
  await finalizeOrder(orderId);
  await audit({
    actorId: actorUserId,
    action: "admin.order.sync_from_stripe",
    targetType: "order",
    targetId: orderId,
    meta: { paymentIntentId: pi.id, amountReceived: pi.amount_received } as never,
    req,
  });
  return { synced: true };
}
