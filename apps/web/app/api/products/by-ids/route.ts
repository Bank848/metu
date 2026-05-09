import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { shapeCardPrices } from "@/lib/server/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_IDS = 24;

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
    where: {
      productId: { in: ids },
      isActive: true,
    },
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
      const ratings = p.reviews.map((r) => r.rating);
      return {
        productId: p.productId,
        name: p.name,
        description: p.description,
        image:
          p.images[0]?.productImage ?? `https://picsum.photos/seed/p${p.productId}/800/600`,
        ...shapeCardPrices(p.items),
        storeName: p.store.name,
        storeId: p.store.storeId,
        avgRating: ratings.length
          ? ratings.reduce((a, b) => a + b, 0) / ratings.length
          : undefined,
        reviewCount: ratings.length,
      };
    });

  return NextResponse.json({ items });
}
