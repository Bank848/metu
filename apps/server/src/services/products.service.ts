import { Prisma } from "@prisma/client";
import { prisma } from "../db/prisma.js";
import type {
  BrowseQuery,
  ProductBrowseResponse,
  ProductDetailResponse,
  ProductListItem,
} from "../models/products.model.js";


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
      store: { select: { name: true, storeId: true, ownerId: true } },
      items: { select: { price: true, discountPercent: true } },
      images: { select: { productImage: true }, orderBy: { sortOrder: "asc" }, take: 1 },
      productNTags: { include: { tag: { select: { tagName: true } } } },
      reviews: { select: { rating: true } },
    },
  });

  // Pull seller levels from v_user_level (live computation off
  // settled orders + rating + revenue) instead of the static
  // user_stats.seller_level column, which was seeded with random
  // values and never recomputed. The view is regular (not
  // materialized) so it always reflects the latest orders.
  const ownerIds = [...new Set(products.map((p) => p.store.ownerId))];
  const sellerLevels = ownerIds.length === 0
    ? new Map<number, number>()
    : new Map(
        (
          await prisma.$queryRaw<Array<{ user_id: number; seller_level: number | null }>>`
            SELECT user_id, seller_level
              FROM v_user_level
             WHERE user_id IN (${Prisma.join(ownerIds)})
          `
        ).map((r) => [r.user_id, Number(r.seller_level ?? 1)]),
      );
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
      sellerLevel: sellerLevels.get(p.store.ownerId) ?? 1,
      avgRating,
      reviewCount: ratings.length,
      discountPercent: maxDiscount || undefined,
      tags: p.productNTags.map((nt) => nt.tag.tagName),
    };
  });
}

export async function findProducts(filters: BrowseQuery): Promise<ProductBrowseResponse> {
  const { category, tags, minPrice, maxPrice, delivery, q, sort } = filters;
  const page = (filters.page as number | undefined) ?? 1;
  const pageSize = (filters.pageSize as number | undefined) ?? 12;

  const anyStoreReady = await prisma.store.count({
    where: { stripeChargesEnabled: true, suspendedAt: null },
  });
  const where: Prisma.ProductWhereInput = {
    isActive: true,
    store: {
      suspendedAt: null,
      ...(anyStoreReady > 0 ? { stripeChargesEnabled: true } : {}),
    },
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

  if (sort === "price_asc" || sort === "price_desc") {
    return findProductsOrderedByPrice(where, page, pageSize, sort);
  }

  const orderBy: Prisma.ProductOrderByWithRelationInput = (() => {
    switch (sort) {
      case "newest":     return { createdAt: "desc" };
      case "rating":     return { reviews: { _count: "desc" } };
      default:           return { createdAt: "desc" };
    }
  })();

  const [items, total] = await Promise.all([
    listProducts(where, orderBy, pageSize, (page - 1) * pageSize),
    prisma.product.count({ where }),
  ]);

  return {
    items,
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

async function findProductsOrderedByPrice(
  where: Prisma.ProductWhereInput,
  page: number,
  pageSize: number,
  sort: "price_asc" | "price_desc",
): Promise<ProductBrowseResponse> {
  const candidates = await prisma.product.findMany({
    where,
    select: { productId: true },
  });
  if (candidates.length === 0) {
    return { items: [], page, pageSize, total: 0, totalPages: 1 };
  }
  const candidateIds = candidates.map((c) => c.productId);
  const direction = sort === "price_asc" ? "ASC" : "DESC";
  const sentinel = sort === "price_asc" ? Number.MAX_SAFE_INTEGER : -1;
  const orderedRows = await prisma.$queryRaw<
    Array<{ product_id: number }>
  >(Prisma.sql`
    SELECT p.product_id
      FROM product p
      LEFT JOIN LATERAL (
        SELECT MIN(price::float * (100 - COALESCE(discount_percent, 0)) / 100.0) AS min_price
          FROM product_item
         WHERE product_id = p.product_id
      ) i ON true
     WHERE p.product_id IN (${Prisma.join(candidateIds)})
     ORDER BY COALESCE(i.min_price, ${sentinel}) ${Prisma.raw(direction)},
              p.product_id ${Prisma.raw(direction)}
  `);

  const total = orderedRows.length;
  const start = (page - 1) * pageSize;
  const pageIds = orderedRows.slice(start, start + pageSize).map((r) => r.product_id);
  if (pageIds.length === 0) {
    return { items: [], page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
  }
  const cards = await listProducts({ productId: { in: pageIds } }, { productId: "asc" }, pageSize, 0);
  const orderIndex = new Map(pageIds.map((id, i) => [id, i]));
  cards.sort(
    (a, b) => (orderIndex.get(a.productId) ?? 0) - (orderIndex.get(b.productId) ?? 0),
  );

  return {
    items: cards,
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function findFeatured(limit = 8): Promise<ProductListItem[]> {
  const anyStoreReady = await prisma.store.count({
    where: { stripeChargesEnabled: true, suspendedAt: null },
  });
  return listProducts(
    {
      isActive: true,
      store: {
        suspendedAt: null,
        ...(anyStoreReady > 0 ? { stripeChargesEnabled: true } : {}),
      },
    },
    { reviews: { _count: "desc" } },
    limit,
    0,
  );
}

export async function findProductById(id: number): Promise<ProductDetailResponse | null> {
  const product = await prisma.product.findUnique({
    where: { productId: id },
    include: {
      store: {
        select: {
          storeId: true,
          ownerId: true,
          name: true,
          profileImage: true,
          coverImage: true,
          description: true,
          suspendedAt: true,
          rating: true,
          businessType: true,
        },
      },
      category: true,
      items: { orderBy: { price: "asc" } },
      images: { orderBy: { sortOrder: "asc" } },
      productNTags: { include: { tag: true } },
      details: { orderBy: { productDetailId: "asc" } },
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
  // findUnique can't filter on the nested store; check post-fetch.
  if (
    !product.isActive ||
    product.store.suspendedAt !== null
  ) {
    return null;
  }
  // Pull the seller level from v_user_level for the store owner so
  // the product detail page can render a Lv.X badge next to the
  // store row. NULL → owner has no store record yet (impossible
  // here, store exists by definition) — fall back to 1.
  const [aggregate, levelRows] = await Promise.all([
    prisma.productReview.aggregate({
      where: { productId: id },
      _count: { _all: true },
      _avg: { rating: true },
    }),
    prisma.$queryRaw<Array<{ seller_level: number | null }>>`
      SELECT seller_level FROM v_user_level WHERE user_id = ${product.store.ownerId}
    `,
  ]);
  const reviewCount = aggregate._count._all;
  const avgRating =
    aggregate._avg.rating !== null && aggregate._avg.rating !== undefined
      ? Number(aggregate._avg.rating)
      : undefined;
  const sellerLevel = Number(levelRows[0]?.seller_level ?? 1);
  // Splice sellerLevel into the store payload so the BFF/page can
  // render it without an extra fetch.
  const storeWithLevel = { ...product.store, sellerLevel };
  return { ...product, store: storeWithLevel, avgRating, reviewCount };
}
