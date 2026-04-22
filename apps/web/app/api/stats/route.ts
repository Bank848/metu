import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  // Public counters — exclude soft-deleted users + products.
  const [sellers, products, orders, reviews] = await Promise.all([
    prisma.userStats.count({ where: { role: "seller", user: { deletedAt: null } } }),
    prisma.product.count({ where: { deletedAt: null } }),
    prisma.order.count(),
    prisma.productReview.count(),
  ]);
  return NextResponse.json({ sellers, products, orders, reviews });
}
