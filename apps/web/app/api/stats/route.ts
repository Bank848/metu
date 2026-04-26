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
  // Phase 11 run #2 / F14 — products count now also gates on live store
  // (matches `/admin/stores` summation so all four surfaces agree).
  const [sellers, products, orders, reviews] = await Promise.all([
    prisma.store.count({ where: { deletedAt: null } }),
    prisma.product.count({ where: { deletedAt: null, store: { deletedAt: null } } }),
    prisma.order.count(),
    prisma.productReview.count(),
  ]);
  return NextResponse.json({ sellers, products, orders, reviews });
}
