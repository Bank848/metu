import { prisma } from "../db/prisma.js";
import { AppError } from "../utils/errors.js";
import type { SellerStatsResponse } from "../models/seller.model.js";

/**
 * Phase 13.9 — seller service. Read-side functions in 13.9.1; the
 * write-side joins this file in 13.9.2. All functions take a
 * `storeId` rather than reaching for the request — keeps them pure
 * + testable.
 */

/** Current seller's store with businessType + stats. */
export async function getStore(storeId: number) {
  return prisma.store.findUnique({
    where: { storeId },
    include: { businessType: true, stats: true },
  });
}

/**
 * List the seller's live products (deletedAt:null) — soft-deleted
 * rows stay out of the dashboard. Admin /admin/audit can still see
 * them via the audit log.
 */
export async function listProducts(storeId: number) {
  return prisma.product.findMany({
    where: { storeId, deletedAt: null },
    orderBy: { productId: "desc" },
    include: {
      category: true,
      items: { orderBy: { price: "asc" } },
      images: { take: 1, orderBy: { sortOrder: "asc" } },
      _count: { select: { reviews: true } },
    },
  });
}

/**
 * Single product, scoped to the seller's store. Throws 404 if the
 * product doesn't exist, 403 if it belongs to a different store.
 * The two errors are deliberately distinct so the dashboard UI can
 * tell them apart (404 = stale link; 403 = bug or attempt).
 */
export async function getProduct(productId: number, storeId: number) {
  const product = await prisma.product.findUnique({
    where: { productId },
    include: {
      category: true,
      items: { orderBy: { productItemId: "asc" } },
      images: { orderBy: { sortOrder: "asc" } },
      productNTags: { include: { tag: true } },
    },
  });
  if (!product) throw new AppError(404, "NotFound");
  if (product.storeId !== storeId) throw new AppError(403, "Forbidden");
  return product;
}

/**
 * Analytics dashboard payload. Five queries fan out in parallel
 * because they touch different tables; the two raw aggregates +
 * top-products query stay serial because they hit overlapping
 * indexes and bursts hurt Neon's free tier.
 */
export async function getStats(storeId: number): Promise<SellerStatsResponse> {
  const [store, productCount, recentReviews, totals] = await Promise.all([
    prisma.store.findUnique({
      where: { storeId },
      include: { stats: true, businessType: true },
    }),
    prisma.product.count({ where: { storeId, deletedAt: null } }),
    prisma.productReview.findMany({
      where: { product: { storeId } },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        user: { select: { firstName: true, lastName: true, profileImage: true } },
        product: { select: { name: true, productId: true } },
      },
    }),
    prisma.$queryRaw<
      Array<{
        paid_count: bigint;
        total_revenue: string | null;
        fulfilled_count: bigint;
        pending_count: bigint;
      }>
    >`
      SELECT
        COUNT(DISTINCT CASE WHEN o.status IN ('paid','fulfilled') THEN o.order_id END)::bigint AS paid_count,
        COALESCE(SUM(CASE WHEN o.status IN ('paid','fulfilled') THEN oi.price_at_purchase * oi.quantity END), 0)::text AS total_revenue,
        COUNT(DISTINCT CASE WHEN o.status = 'fulfilled' THEN o.order_id END)::bigint AS fulfilled_count,
        COUNT(DISTINCT CASE WHEN o.status = 'pending' THEN o.order_id END)::bigint AS pending_count
      FROM order_item oi
      JOIN product_item pi ON pi.product_item_id = oi.product_item_id
      JOIN product p ON p.product_id = pi.product_id
      JOIN orders o ON o.order_id = oi.order_id
      WHERE p.store_id = ${storeId}
    `,
  ]);

  const dailyOrders = await prisma.$queryRaw<
    Array<{ day: Date; count: bigint }>
  >`
    SELECT DATE_TRUNC('day', o.created_at)::date AS day, COUNT(DISTINCT o.order_id)::bigint AS count
    FROM orders o
    JOIN order_item oi ON oi.order_id = o.order_id
    JOIN product_item pi ON pi.product_item_id = oi.product_item_id
    JOIN product p ON p.product_id = pi.product_id
    WHERE p.store_id = ${storeId}
      AND o.created_at >= NOW() - INTERVAL '30 days'
    GROUP BY day
    ORDER BY day
  `;

  const topProducts = await prisma.$queryRaw<
    Array<{ product_id: number; name: string; revenue: string; units: bigint }>
  >`
    SELECT p.product_id, p.name,
           COALESCE(SUM(oi.price_at_purchase * oi.quantity), 0)::text AS revenue,
           COALESCE(SUM(oi.quantity), 0)::bigint AS units
    FROM product p
    LEFT JOIN product_item pi ON pi.product_id = p.product_id
    LEFT JOIN order_item oi ON oi.product_item_id = pi.product_item_id
    WHERE p.store_id = ${storeId}
    GROUP BY p.product_id, p.name
    ORDER BY revenue DESC
    LIMIT 5
  `;

  return {
    store,
    productCount,
    kpi: {
      paidCount: Number(totals[0]?.paid_count ?? 0),
      totalRevenue: Number(totals[0]?.total_revenue ?? 0),
      fulfilledCount: Number(totals[0]?.fulfilled_count ?? 0),
      pendingCount: Number(totals[0]?.pending_count ?? 0),
    },
    dailyOrders: dailyOrders.map((r) => ({
      day: r.day,
      count: Number(r.count),
    })),
    topProducts: topProducts.map((r) => ({
      productId: r.product_id,
      name: r.name,
      revenue: Number(r.revenue),
      units: Number(r.units),
    })),
    recentReviews,
  };
}

/**
 * Orders the seller should care about — every order containing at
 * least one line from their store. Optional ?status filter passes
 * through to Prisma's enum check.
 *
 * Scoped sub-includes: nested `items` only resolve to lines for THIS
 * store so we don't leak details about competitors' products if the
 * order is multi-store.
 */
export async function listOrders(storeId: number, status?: string) {
  return prisma.order.findMany({
    where: {
      ...(status ? { status: status as any } : {}),
      items: {
        some: { productItem: { product: { storeId } } },
      },
    },
    orderBy: { createdAt: "desc" },
    include: {
      cart: {
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
      },
      items: {
        where: { productItem: { product: { storeId } } },
        include: {
          productItem: {
            include: {
              product: {
                select: {
                  name: true,
                  productId: true,
                  images: { take: 1, orderBy: { sortOrder: "asc" } },
                },
              },
            },
          },
        },
      },
      transaction: true,
    },
  });
}

/**
 * CSV export — same dataset as listOrders but flattened into one
 * row per (order, line item). Returns the CSV body as a string;
 * the controller adds the Content-Type / Content-Disposition headers.
 */
export async function exportOrdersCsv(storeId: number): Promise<string> {
  const orders = await prisma.order.findMany({
    where: {
      items: { some: { productItem: { product: { storeId } } } },
    },
    orderBy: { createdAt: "desc" },
    include: {
      cart: {
        include: {
          user: {
            select: {
              username: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      },
      items: {
        include: {
          productItem: {
            include: { product: { select: { storeId: true, name: true } } },
          },
        },
      },
    },
  });

  const header = [
    "order_id",
    "order_date",
    "order_status",
    "order_total",
    "buyer_username",
    "buyer_name",
    "buyer_email",
    "product_name",
    "delivery_method",
    "quantity",
    "unit_price",
    "line_subtotal",
  ];
  const rows: string[] = [header.join(",")];

  for (const o of orders) {
    for (const li of o.items) {
      // Skip lines belonging to OTHER stores — order may be multi-store.
      if (li.productItem.product.storeId !== storeId) continue;
      const subtotal = Number(li.priceAtPurchase) * li.quantity;
      const cells = [
        o.orderId,
        o.createdAt.toISOString(),
        o.status,
        Number(o.totalPrice).toFixed(2),
        o.cart.user.username,
        `${o.cart.user.firstName} ${o.cart.user.lastName}`.trim(),
        o.cart.user.email,
        li.productItem.product.name,
        li.productItem.deliveryMethod,
        li.quantity,
        Number(li.priceAtPurchase).toFixed(2),
        subtotal.toFixed(2),
      ];
      rows.push(cells.map(escapeCsv).join(","));
    }
  }

  return rows.join("\n");
}

function escapeCsv(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}
