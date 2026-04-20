import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireAuth } from "@/lib/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { name: string } }) {
  const r = await requireAuth(req, ["admin"]);
  if (!r.ok) return r.response;
  const { name } = params;

  switch (name) {
    case "revenue-by-category": {
      const sql = `
-- Revenue by category: join orders → order_items → product_items → products → categories
-- and aggregate SUM(price_at_purchase * quantity) where the order is paid/fulfilled.
SELECT c.category_id, c.category_name,
       SUM(oi.price_at_purchase * oi.quantity)::text AS revenue,
       COUNT(DISTINCT o.order_id)::bigint AS orders
FROM orders o
JOIN order_item oi  ON oi.order_id = o.order_id
JOIN product_item pi ON pi.product_item_id = oi.product_item_id
JOIN product p       ON p.product_id = pi.product_id
JOIN category c      ON c.category_id = p.category_id
WHERE o.status IN ('paid','fulfilled')
GROUP BY c.category_id, c.category_name
ORDER BY revenue DESC`;
      const rows = await prisma.$queryRaw<Array<{ category_id: number; category_name: string; revenue: string; orders: bigint }>>`
        SELECT c.category_id, c.category_name,
               SUM(oi.price_at_purchase * oi.quantity)::text AS revenue,
               COUNT(DISTINCT o.order_id)::bigint AS orders
        FROM orders o
        JOIN order_item oi  ON oi.order_id = o.order_id
        JOIN product_item pi ON pi.product_item_id = oi.product_item_id
        JOIN product p       ON p.product_id = pi.product_id
        JOIN category c      ON c.category_id = p.category_id
        WHERE o.status IN ('paid','fulfilled')
        GROUP BY c.category_id, c.category_name
        ORDER BY revenue DESC
      `;
      return NextResponse.json({ sql, rows: rows.map((r) => ({ ...r, orders: Number(r.orders), revenue: Number(r.revenue) })) });
    }
    case "top-stores": {
      const sql = `
SELECT s.store_id, s.name,
       COALESCE(SUM(oi.price_at_purchase * oi.quantity), 0)::text AS revenue,
       COUNT(DISTINCT o.order_id)::bigint AS orders
FROM store s
LEFT JOIN product p       ON p.store_id = s.store_id
LEFT JOIN product_item pi ON pi.product_id = p.product_id
LEFT JOIN order_item oi   ON oi.product_item_id = pi.product_item_id
LEFT JOIN orders o        ON o.order_id = oi.order_id AND o.status IN ('paid','fulfilled')
GROUP BY s.store_id, s.name
ORDER BY revenue DESC
LIMIT 10`;
      const rows = await prisma.$queryRaw<Array<{ store_id: number; name: string; revenue: string; orders: bigint }>>`
        SELECT s.store_id, s.name,
               COALESCE(SUM(oi.price_at_purchase * oi.quantity), 0)::text AS revenue,
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
      return NextResponse.json({ sql, rows: rows.map((r) => ({ ...r, orders: Number(r.orders), revenue: Number(r.revenue) })) });
    }
    case "orders-by-status": {
      const sql = `SELECT status, COUNT(*)::bigint AS count FROM orders GROUP BY status ORDER BY count DESC`;
      const rows = await prisma.$queryRaw<Array<{ status: string; count: bigint }>>`
        SELECT status::text, COUNT(*)::bigint AS count FROM orders GROUP BY status ORDER BY count DESC
      `;
      return NextResponse.json({ sql, rows: rows.map((r) => ({ ...r, count: Number(r.count) })) });
    }
    case "signups-per-day": {
      const sql = `
SELECT DATE_TRUNC('day', created_date)::date AS day, COUNT(*)::bigint AS count
FROM "users"
WHERE created_date >= NOW() - INTERVAL '60 days'
GROUP BY day ORDER BY day`;
      const rows = await prisma.$queryRaw<Array<{ day: Date; count: bigint }>>`
        SELECT DATE_TRUNC('day', created_date)::date AS day, COUNT(*)::bigint AS count
        FROM "users"
        WHERE created_date >= NOW() - INTERVAL '60 days'
        GROUP BY day ORDER BY day
      `;
      return NextResponse.json({ sql, rows: rows.map((r) => ({ ...r, count: Number(r.count) })) });
    }
    case "coupon-usage": {
      const sql = `
SELECT c.code, c.discount_type, c.discount_value,
       COUNT(cu.usage_id)::bigint AS times_used, c.usage_limit
FROM coupon c
LEFT JOIN coupon_usage cu ON cu.coupon_id = c.coupon_id
GROUP BY c.coupon_id, c.code, c.discount_type, c.discount_value, c.usage_limit
ORDER BY times_used DESC`;
      const rows = await prisma.$queryRaw<Array<{ code: string; discount_type: string; discount_value: number; times_used: bigint; usage_limit: number }>>`
        SELECT c.code, c.discount_type::text, c.discount_value,
               COUNT(cu.usage_id)::bigint AS times_used, c.usage_limit
        FROM coupon c
        LEFT JOIN coupon_usage cu ON cu.coupon_id = c.coupon_id
        GROUP BY c.coupon_id, c.code, c.discount_type, c.discount_value, c.usage_limit
        ORDER BY times_used DESC
      `;
      return NextResponse.json({ sql, rows: rows.map((r) => ({ ...r, times_used: Number(r.times_used) })) });
    }
    default:
      return NextResponse.json({ error: "UnknownReport" }, { status: 404 });
  }
}
