import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  // Public counters — exclude soft-deleted rows.
  //
  // Phase 11 / F10 (CEO Decision 3) — `sellers` now counts `Store` rows
  // (mirroring `getStats()` in lib/server/queries.ts) so the JSON
  // endpoint returns the same number the homepage renders.
  const [sellers, products, orders, reviews] = await Promise.all([
    prisma.store.count({ where: { deletedAt: null } }),
    prisma.product.count({ where: { deletedAt: null } }),
    prisma.order.count(),
    prisma.productReview.count(),
  ]);
  return NextResponse.json({ sellers, products, orders, reviews });
}
