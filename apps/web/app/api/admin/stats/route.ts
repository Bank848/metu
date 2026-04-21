import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireAuth } from "@/lib/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const r = await requireAuth(req, ["admin"]);
  if (!r.ok) return r.response;

  const [users, stores, products, reviews, orders, gmv, pendingOrders, recentTx, daily] = await Promise.all([
    prisma.user.count(),
    prisma.store.count(),
    prisma.product.count(),
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
        user: { select: { username: true, firstName: true, lastName: true, profileImage: true } },
      },
    }),
    // Daily revenue for the last 14 days — drives the dashboard sparkline.
    prisma.$queryRaw<Array<{ day: string; revenue: string; order_count: bigint }>>`
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
  return NextResponse.json({
    users, stores, products, reviews, orders,
    gmv: Number(gmv[0]?.total ?? 0),
    pendingOrders,
    recentTransactions: recentTx,
    daily: daily.map((d) => ({ day: d.day, revenue: Number(d.revenue), orderCount: Number(d.order_count) })),
  });
}
