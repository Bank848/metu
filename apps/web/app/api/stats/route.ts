import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const [sellers, products, orders, reviews] = await Promise.all([
    prisma.userStats.count({ where: { role: "seller" } }),
    prisma.product.count(),
    prisma.order.count(),
    prisma.productReview.count(),
  ]);
  return NextResponse.json({ sellers, products, orders, reviews });
}
