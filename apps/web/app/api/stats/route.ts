import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  // Public counters. `sellers` counts Store rows so this JSON matches
  // what the homepage and /admin surfaces render.
  const [sellers, products, orders, reviews] = await Promise.all([
    prisma.store.count(),
    prisma.product.count(),
    prisma.order.count(),
    prisma.productReview.count(),
  ]);
  return NextResponse.json({ sellers, products, orders, reviews });
}
