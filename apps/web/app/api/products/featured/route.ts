import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { shapeCardPrices } from "@/lib/server/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const products = await prisma.product.findMany({
    where: { isActive: true },
    orderBy: { reviews: { _count: "desc" } },
    take: 8,
    include: {
      store: { select: { name: true, storeId: true } },
      items: { select: { price: true, discountPercent: true } },
      images: { select: { productImage: true }, orderBy: { sortOrder: "asc" }, take: 1 },
      productNTags: { include: { tag: { select: { tagName: true } } } },
      reviews: { select: { rating: true } },
    },
  });
  const shaped = products.map((p) => {
    const ratings = p.reviews.map((r) => r.rating);
    return {
      productId: p.productId,
      name: p.name,
      description: p.description,
      image: p.images[0]?.productImage ?? `https://picsum.photos/seed/p${p.productId}/800/600`,
      ...shapeCardPrices(p.items),
      storeName: p.store.name,
      storeId: p.store.storeId,
      avgRating: ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : undefined,
      reviewCount: ratings.length,
      tags: p.productNTags.map((nt) => nt.tag.tagName),
    };
  });
  return NextResponse.json(shaped);
}
