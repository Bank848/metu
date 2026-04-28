import { Prisma } from "@prisma/client";
import { prisma } from "../db/prisma.js";
import type {
  BrowseQuery,
  ProductBrowseResponse,
  ProductDetailResponse,
  ProductListItem,
} from "../models/products.model.js";

/**
 * Internal shaper — turns a Prisma `product.findMany` row (with the
 * specific include set below) into the `ProductListItem` DTO. Kept
 * private because the include shape is tightly coupled to this
 * function's mapping logic.
 */
async function listProducts(
  where: Prisma.ProductWhereInput,
  orderBy: Prisma.ProductOrderByWithRelationInput,
  take: number,
  skip: number,
): Promise<ProductListItem[]> {
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

/**
 * Browse — the workhorse query for /browse. Mirrors the legacy
 * `apps/web/lib/server/queries.ts:browseProducts()` 1:1 so the BFF
 * layer can switch from direct-Prisma to fetch-this-service without
 * any consumer-visible behavior change.
 */
export async function findProducts(filters: BrowseQuery): Promise<ProductBrowseResponse> {
  const { category, tags, minPrice, maxPrice, delivery, q, sort } = filters;
  // Defaults mirror the zod schema (page=1, pageSize=12). The
  // double-fallback keeps strict TS happy across packages even when
  // `BrowseQuery`'s `default()` types resolve as optional in the
  // consumer's tsconfig context.
  const page = (filters.page as number | undefined) ?? 1;
  const pageSize = (filters.pageSize as number | undefined) ?? 12;

  // Public-catalogue gates — the BFF used to apply these inline. We
  // pull them server-side so any future API consumer (mobile, partner)
  // gets the same filtered view without re-implementing it.
  //   • isActive    — sellers can pause a product without delisting it
  //   • deletedAt   — soft-deleted products are admin-only
  //   • store.deletedAt — orphan products from a deleted store
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
    const tagIds = tags
      .split(",")
      .map((s: string) => Number(s))
      .filter(Boolean);
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

  // Note: price_asc / price_desc need an in-memory pass after the
  // query because `minPrice` is computed across the variants table —
  // Postgres can't `ORDER BY MIN(items.price)` without a GROUP BY
  // dance that complicates pagination. We accept the small N within
  // a page.
  const orderBy: Prisma.ProductOrderByWithRelationInput = (() => {
    switch (sort) {
      case "newest":     return { createdAt: "desc" };
      case "price_asc":  return { productId: "asc" };
      case "price_desc": return { productId: "desc" };
      case "rating":     return { reviews: { _count: "desc" } };
      default:           return { createdAt: "desc" };
    }
  })();

  const [items, total] = await Promise.all([
    listProducts(where, orderBy, pageSize, (page - 1) * pageSize),
    prisma.product.count({ where }),
  ]);

  if (sort === "price_asc")  items.sort((a, b) => a.minPrice - b.minPrice);
  if (sort === "price_desc") items.sort((a, b) => b.minPrice - a.minPrice);

  return {
    items,
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/**
 * Featured — top N by review count. Used by the homepage trending
 * grid + cart's "you might also like" recommendation strip. Same
 * public-catalogue gates as `findProducts`.
 */
export async function findFeatured(limit = 8): Promise<ProductListItem[]> {
  return listProducts(
    { isActive: true, deletedAt: null, store: { deletedAt: null } },
    { reviews: { _count: "desc" } },
    limit,
    0,
  );
}

/**
 * Detail — single product with full include tree (gallery, variants,
 * tags, recent 20 reviews). Returns `null` when not found so the
 * controller can decide between 404 and another behaviour.
 */
export async function findProductById(id: number): Promise<ProductDetailResponse | null> {
  const product = await prisma.product.findUnique({
    where: { productId: id },
    include: {
      store: { include: { stats: true, businessType: true } },
      category: true,
      items: { orderBy: { price: "asc" } },
      images: { orderBy: { sortOrder: "asc" } },
      productNTags: { include: { tag: true } },
      reviews: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              profileImage: true,
              username: true,
            },
          },
        },
      },
    },
  });
  if (!product) return null;
  const ratings = product.reviews.map((r) => r.rating);
  const avgRating = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : undefined;
  return { ...product, avgRating, reviewCount: ratings.length };
}
