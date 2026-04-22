import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { browseQuerySchema } from "@metu/shared";
import { prisma } from "@/lib/server/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function listProducts(
  where: Prisma.ProductWhereInput,
  orderBy: Prisma.ProductOrderByWithRelationInput,
  take: number,
  skip: number,
) {
  const products = await prisma.product.findMany({
    where,
    orderBy,
    take,
    skip,
    include: {
      store: { select: { name: true, storeId: true } },
      items: { select: { price: true, discountPercent: true } },
      images: { select: { productImage: true }, orderBy: { sortOrder: "asc" }, take: 1 },
      productNTags: { include: { tag: { select: { tagName: true } } } },
      reviews: { select: { rating: true } },
    },
  });
  return products.map((p) => {
    const prices = p.items.map((i) => Number(i.price));
    const minPrice = prices.length ? Math.min(...prices) : 0;
    const maxPrice = prices.length ? Math.max(...prices) : 0;
    const ratings = p.reviews.map((r) => r.rating);
    const avgRating = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : undefined;
    const maxDiscount = p.items.reduce((m, it) => Math.max(m, it.discountPercent ?? 0), 0);
    return {
      productId: p.productId,
      name: p.name,
      description: p.description,
      image: p.images[0]?.productImage ?? `https://picsum.photos/seed/p${p.productId}/800/600`,
      minPrice,
      maxPrice,
      storeName: p.store.name,
      storeId: p.store.storeId,
      avgRating,
      reviewCount: ratings.length,
      discountPercent: maxDiscount || undefined,
      tags: p.productNTags.map((nt) => nt.tag.tagName),
    };
  });
}

export async function GET(req: NextRequest) {
  const params = Object.fromEntries(req.nextUrl.searchParams);
  const parsed = browseQuerySchema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json({ error: "ValidationError", details: parsed.error.flatten() }, { status: 400 });
  }
  const { category, tags, minPrice, maxPrice, delivery, q, sort, page, pageSize } = parsed.data;

  // Public listing — exclude paused, soft-deleted, and orphaned products.
  const where: Prisma.ProductWhereInput = {
    isActive: true,
    deletedAt: null,
    store: { deletedAt: null },
  };
  if (category) where.categoryId = category;
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
      { store: { name: { contains: q, mode: "insensitive" } } },
      { productNTags: { some: { tag: { tagName: { contains: q, mode: "insensitive" } } } } },
    ];
  }
  if (tags) {
    const tagIds = tags.split(",").map((s) => Number(s)).filter(Boolean);
    if (tagIds.length) where.productNTags = { some: { tagId: { in: tagIds } } };
  }
  if (minPrice !== undefined || maxPrice !== undefined || delivery) {
    where.items = {
      some: {
        ...(minPrice !== undefined ? { price: { gte: minPrice } } : {}),
        ...(maxPrice !== undefined ? { price: { lte: maxPrice } } : {}),
        ...(delivery ? { deliveryMethod: delivery } : {}),
      },
    };
  }

  const orderBy: Prisma.ProductOrderByWithRelationInput = (() => {
    switch (sort) {
      case "newest": return { createdAt: "desc" };
      case "price_asc": return { productId: "asc" };
      case "price_desc": return { productId: "desc" };
      case "rating": return { reviews: { _count: "desc" } };
      default: return { createdAt: "desc" };
    }
  })();

  const [items, total] = await Promise.all([
    listProducts(where, orderBy, pageSize, (page - 1) * pageSize),
    prisma.product.count({ where }),
  ]);

  if (sort === "price_asc") items.sort((a, b) => a.minPrice - b.minPrice);
  if (sort === "price_desc") items.sort((a, b) => b.minPrice - a.minPrice);

  return NextResponse.json({
    items,
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  });
}
