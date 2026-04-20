import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireAuth } from "@/lib/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const r = await requireAuth(req, ["admin"]);
  if (!r.ok) return r.response;

  const [users, stores, products, reviews, orders, gmv, pendingOrders] = await Promise.all([
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
  ]);
  const recentTx = await prisma.transaction.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
    include: {
      user: { select: { username: true, firstName: true, lastName: true, profileImage: true } },
    },
  });
  return NextResponse.json({
    users, stores, products, reviews, orders,
    gmv: Number(gmv[0]?.total ?? 0),
    pendingOrders,
    recentTransactions: recentTx,
  });
}
