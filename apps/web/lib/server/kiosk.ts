import { prisma } from "@/lib/server/prisma";

// Public kiosk data — no PII, no auth required. The /feature-tour page
// runs as an unattended display, so everything here is safe to show in a
// public space (store names, product names, aggregate counts; never
// usernames, emails, or anything tied to a specific buyer).

export interface KioskData {
  counts: {
    users: number;
    stores: number;
    products: number;
    orders: number;
    gmv: number;
    reviews: number;
  };
  topStores: Array<{
    storeId: number;
    name: string;
    revenue: number;
    orders: number;
    profileImage: string | null;
  }>;
  topProducts: Array<{
    productId: number;
    name: string;
    storeName: string;
    revenue: number;
    units: number;
    coverImage: string | null;
  }>;
  recentOrders: Array<{
    orderId: number;
    productName: string;
    storeName: string | null;
    amount: number;
    createdAt: string;
  }>;
  daily: Array<{ day: string; revenue: number; orderCount: number }>;
  fetchedAt: string;
}

export async function getKioskData(): Promise<KioskData> {
  type CountsRow = {
    users: bigint; stores: bigint; products: bigint;
    orders: bigint; gmv: string; reviews: bigint;
  };
  type StoreRow = {
    store_id: number; name: string; profile_image: string | null;
    revenue: string; orders: bigint;
  };
  type ProductRow = {
    product_id: number; name: string; store_name: string;
    revenue: string; units: bigint; cover_image: string | null;
  };
  type OrderRow = {
    order_id: number; product_name: string; store_name: string | null;
    amount: string; created_at: Date;
  };
  type DailyRow = { day: string; revenue: string; order_count: bigint };

  const [counts, topStores, topProducts, recentOrders, daily] = await Promise.all([
    prisma.$queryRaw<CountsRow[]>`
      SELECT
        (SELECT COUNT(*) FROM "users")           AS users,
        (SELECT COUNT(*) FROM "store")           AS stores,
        (SELECT COUNT(*) FROM "product")         AS products,
        (SELECT COUNT(*) FROM "orders")          AS orders,
        (SELECT COALESCE(SUM(total_price), 0)::text
           FROM "orders"
          WHERE status IN ('paid', 'fulfilled')) AS gmv,
        (SELECT COUNT(*) FROM "product_review")  AS reviews
    `,
    prisma.$queryRaw<StoreRow[]>`
      SELECT s.store_id, s.name, s.profile_image,
             COALESCE(SUM(oi.price_per_unit * oi.quantity)::text, '0') AS revenue,
             COUNT(DISTINCT o.order_id)                                AS orders
        FROM "store" s
        JOIN "product"      p  ON p.store_id  = s.store_id
        JOIN "product_item" pi ON pi.product_id = p.product_id
        JOIN "order_item"   oi ON oi.product_item_id = pi.product_item_id
        JOIN "orders"       o  ON o.order_id  = oi.order_id
       WHERE o.status IN ('paid', 'fulfilled')
         AND s.suspended_at IS NULL
       GROUP BY s.store_id, s.name, s.profile_image
       ORDER BY SUM(oi.price_per_unit * oi.quantity) DESC NULLS LAST
       LIMIT 5
    `,
    prisma.$queryRaw<ProductRow[]>`
      SELECT p.product_id, p.name, s.name AS store_name,
             COALESCE(SUM(oi.price_per_unit * oi.quantity)::text, '0') AS revenue,
             COALESCE(SUM(oi.quantity), 0)::bigint                     AS units,
             (SELECT product_image FROM "product_image" pi2
               WHERE pi2.product_id = p.product_id
               ORDER BY pi2.sort_order ASC LIMIT 1)                    AS cover_image
        FROM "product" p
        JOIN "store"        s  ON s.store_id = p.store_id
        JOIN "product_item" pi ON pi.product_id = p.product_id
        JOIN "order_item"   oi ON oi.product_item_id = pi.product_item_id
        JOIN "orders"       o  ON o.order_id  = oi.order_id
       WHERE o.status IN ('paid', 'fulfilled')
         AND s.suspended_at IS NULL
       GROUP BY p.product_id, p.name, s.name
       ORDER BY SUM(oi.price_per_unit * oi.quantity) DESC NULLS LAST
       LIMIT 5
    `,
    prisma.$queryRaw<OrderRow[]>`
      SELECT o.order_id,
             COALESCE(p.name, oi.product_name_snapshot) AS product_name,
             s.name                                     AS store_name,
             (oi.price_per_unit * oi.quantity)::text    AS amount,
             o.created_at
        FROM "orders"     o
        JOIN "order_item" oi ON oi.order_id = o.order_id
        LEFT JOIN "product_item" pi ON pi.product_item_id = oi.product_item_id
        LEFT JOIN "product"      p  ON p.product_id = pi.product_id
        LEFT JOIN "store"        s  ON s.store_id  = p.store_id
       WHERE o.status IN ('paid', 'fulfilled')
       ORDER BY o.created_at DESC
       LIMIT 8
    `,
    prisma.$queryRaw<DailyRow[]>`
      SELECT TO_CHAR(d::date, 'YYYY-MM-DD') AS day,
             COALESCE(SUM(o.total_price) FILTER (WHERE o.status IN ('paid','fulfilled')), 0)::text AS revenue,
             COUNT(o.order_id) FILTER (WHERE o.status IN ('paid','fulfilled')) AS order_count
        FROM generate_series(CURRENT_DATE - INTERVAL '13 days', CURRENT_DATE, INTERVAL '1 day') d
        LEFT JOIN "orders" o ON DATE(o.created_at) = d::date
       GROUP BY d
       ORDER BY d ASC
    `,
  ]);

  const c = counts[0]!;
  return {
    counts: {
      users: Number(c.users),
      stores: Number(c.stores),
      products: Number(c.products),
      orders: Number(c.orders),
      gmv: Number(c.gmv),
      reviews: Number(c.reviews),
    },
    topStores: topStores.map((s) => ({
      storeId: s.store_id,
      name: s.name,
      revenue: Number(s.revenue),
      orders: Number(s.orders),
      profileImage: s.profile_image,
    })),
    topProducts: topProducts.map((p) => ({
      productId: p.product_id,
      name: p.name,
      storeName: p.store_name,
      revenue: Number(p.revenue),
      units: Number(p.units),
      coverImage: p.cover_image,
    })),
    recentOrders: recentOrders.map((o) => ({
      orderId: o.order_id,
      productName: o.product_name,
      storeName: o.store_name,
      amount: Number(o.amount),
      createdAt: o.created_at.toISOString(),
    })),
    daily: daily.map((d) => ({
      day: d.day,
      revenue: Number(d.revenue),
      orderCount: Number(d.order_count),
    })),
    fetchedAt: new Date().toISOString(),
  };
}
