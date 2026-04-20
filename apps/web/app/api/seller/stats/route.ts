import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { withStore } from "@/lib/server/seller";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const r = await withStore(req);
  if (!r.ok) return r.response;
  const storeId = r.store.storeId;

  const [store, productCount, recentReviews, totals] = await Promise.all([
    prisma.store.findUnique({ where: { storeId }, include: { stats: true, businessType: true } }),
    prisma.product.count({ where: { storeId } }),
    prisma.productReview.findMany({
      where: { product: { storeId } },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        user: { select: { firstName: true, lastName: true, profileImage: true } },
        product: { select: { name: true, productId: true } },
      },
    }),
    prisma.$queryRaw<Array<{ paid_count: bigint; total_revenue: string | null; fulfilled_count: bigint; pending_count: bigint }>>`
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

  const dailyOrders = await prisma.$queryRaw<Array<{ day: Date; count: bigint }>>`
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

  const topProducts = await prisma.$queryRaw<Array<{ product_id: number; name: string; revenue: string; units: bigint }>>`
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

  return NextResponse.json({
    store,
    productCount,
    kpi: {
      paidCount: Number(totals[0]?.paid_count ?? 0),
      totalRevenue: Number(totals[0]?.total_revenue ?? 0),
      fulfilledCount: Number(totals[0]?.fulfilled_count ?? 0),
      pendingCount: Number(totals[0]?.pending_count ?? 0),
    },
    dailyOrders: dailyOrders.map((r) => ({ day: r.day, count: Number(r.count) })),
    topProducts: topProducts.map((r) => ({
      productId: r.product_id, name: r.name, revenue: Number(r.revenue), units: Number(r.units),
    })),
    recentReviews,
  });
}
