import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/server/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_IDS = 24;

/**
 * GET /api/products/by-ids?ids=1,2,3 — returns ProductCard-shaped rows
 * for the requested ids, preserving the order the client sent. Used by
 * the "Recently viewed" strip on /browse, which keeps a small history
 * in localStorage and asks us to hydrate it.
 */
export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("ids") ?? "";
  const ids = Array.from(
    new Set(
      raw
        .split(",")
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isFinite(n) && n > 0),
    ),
  ).slice(0, MAX_IDS);

  if (ids.length === 0) return NextResponse.json({ items: [] });

  const products = await prisma.product.findMany({
    where: { productId: { in: ids } },
    include: {
      store: { select: { name: true, storeId: true } },
      items: { select: { price: true, discountPercent: true } },
      images: { select: { productImage: true }, orderBy: { sortOrder: "asc" }, take: 1 },
      reviews: { select: { rating: true } },
    },
  });

  const byId = new Map(products.map((p) => [p.productId, p]));
  const items = ids
    .map((id) => byId.get(id))
    .filter(<T,>(p: T | undefined): p is T => p !== undefined)
    .map((p) => {
      const prices = p.items.map((i) => Number(i.price));
      const ratings = p.reviews.map((r) => r.rating);
      const maxDiscount = p.items.reduce((m, it) => Math.max(m, it.discountPercent ?? 0), 0);
      return {
        productId: p.productId,
        name: p.name,
        description: p.description,
        image:
          p.images[0]?.productImage ?? `https://picsum.photos/seed/p${p.productId}/800/600`,
        minPrice: prices.length ? Math.min(...prices) : 0,
        maxPrice: prices.length ? Math.max(...prices) : 0,
        storeName: p.store.name,
        storeId: p.store.storeId,
        avgRating: ratings.length
          ? ratings.reduce((a, b) => a + b, 0) / ratings.length
          : undefined,
        reviewCount: ratings.length,
        discountPercent: maxDiscount || undefined,
      };
    });

  return NextResponse.json({ items });
}
