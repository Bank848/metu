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

  // Public catalogue gates: paused, soft-deleted, deleted-store,
  // suspended-store, and (when any store has finished Stripe Connect
  // onboarding) only stores that can actually accept payment. The
  // "any store ready" check is a safety fallback so /browse isn't
  // empty in pre-onboarding demos — users still see the catalogue,
  // and our cart guard rejects checkout against non-ready stores
  // with a clear error.
  const anyStoreReady = await prisma.store.count({
    where: { stripeChargesEnabled: true, deletedAt: null, suspendedAt: null },
  });
  const where: Prisma.ProductWhereInput = {
    isActive: true,
    deletedAt: null,
    store: {
      deletedAt: null,
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

  // Phase 50 — price sort needs to be DB-side so pagination is
  // correct across the whole result set. Previously we ordered by
  // `productId` then sorted by `minPrice` in JS *after* paginating,
  // which meant cheap products on later pages stayed there — the
  // user's "cheapest first" page was actually "cheapest within an
  // arbitrary id slice". For price sort we run a separate
  // `groupBy(productItem)` to compute MIN(effective price), then
  // page through the resulting id list and load the cards by id.
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

/**
 * Phase 50 — DB-level price sort. Strategy:
 *   1. List every product matching the filter, but only its
 *      productId + a synthetic `effectiveMinPrice` aggregated from
 *      product_item (price * (1 - discount/100)). Done in raw SQL
 *      so we get a window-friendly ORDER BY without GROUP BY pain.
 *   2. Slice the ordered ids to the current page.
 *   3. Hand the slice to `listProducts` with an id-preserving
 *      ORDER BY so the cards come back in the right order.
 */
async function findProductsOrderedByPrice(
  where: Prisma.ProductWhereInput,
  page: number,
  pageSize: number,
  sort: "price_asc" | "price_desc",
): Promise<ProductBrowseResponse> {
  // Pull candidate ids first; we only need the id list to compute the
  // MIN price. `findMany` with this where lets Prisma handle the
  // complex `store: { … }` and `productNTags: { some: { … } }` joins
  // we'd otherwise have to repeat in raw SQL.
  const candidates = await prisma.product.findMany({
    where,
    select: { productId: true },
  });
  if (candidates.length === 0) {
    return { items: [], page, pageSize, total: 0, totalPages: 1 };
  }
  const candidateIds = candidates.map((c) => c.productId);

  // Effective unit price = price * (100 - discountPercent) / 100.
  // MIN across the variants is the card's "from" price. We coalesce
  // missing variants to a sentinel so a product with no items still
  // appears (sorted to the bottom for asc, top for desc — operationally
  // these are mis-configured products we want the seller to notice).
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

  // Load the page of cards. Prisma can't preserve the explicit id
  // order from the IN clause so we re-sort in JS — but this is only
  // sorting `pageSize` rows (typically ≤ 24), not the full set.
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

/**
 * Featured — top N by review count. Used by the homepage trending
 * grid + cart's "you might also like" recommendation strip. Same
 * public-catalogue gates as `findProducts`.
 */
export async function findFeatured(limit = 8): Promise<ProductListItem[]> {
  // Same safety fallback as findProducts — only enforce the Stripe
  // gate once at least one store is actually ready, otherwise show
  // the seed catalogue as-is.
  const anyStoreReady = await prisma.store.count({
    where: { stripeChargesEnabled: true, deletedAt: null, suspendedAt: null },
  });
  return listProducts(
    {
      isActive: true,
      deletedAt: null,
      store: {
        deletedAt: null,
        suspendedAt: null,
        ...(anyStoreReady > 0 ? { stripeChargesEnabled: true } : {}),
      },
    },
    { reviews: { _count: "desc" } },
    limit,
    0,
  );
}

/**
 * Detail — single product with full include tree (gallery, variants,
 * tags, recent 20 reviews). Returns `null` when not found so the
 * controller can decide between 404 and another behaviour.
 *
 * Phase 50 — `avgRating` and `reviewCount` were previously computed
 * from the take:20 review list, so a product with 100 reviews showed
 * an average over a non-deterministic window of 20 and a count of
 * "20" instead of 100. Now we run a separate `_count` + `_avg.rating`
 * aggregate that sees every review row, while the include continues
 * to ship the latest 20 for the UI list.
 *
 * Also gates `isActive` so a paused product can't be reached via
 * direct URL — matches the public-catalogue gate used by `findProducts`.
 */
export async function findProductById(id: number): Promise<ProductDetailResponse | null> {
  const product = await prisma.product.findUnique({
    where: { productId: id },
    include: {
      store: {
        select: {
          storeId: true,
          name: true,
          profileImage: true,
          coverImage: true,
          description: true,
          deletedAt: true,
          suspendedAt: true,
          stats: true,
          businessType: true,
        },
      },
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
  // findUnique can't filter on the nested store; check post-fetch.
  if (
    product.deletedAt !== null ||
    !product.isActive ||
    product.store.deletedAt !== null ||
    product.store.suspendedAt !== null
  ) {
    return null;
  }
  const aggregate = await prisma.productReview.aggregate({
    where: { productId: id },
    _count: { _all: true },
    _avg: { rating: true },
  });
  const reviewCount = aggregate._count._all;
  const avgRating =
    aggregate._avg.rating !== null && aggregate._avg.rating !== undefined
      ? Number(aggregate._avg.rating)
      : undefined;
  return { ...product, avgRating, reviewCount };
}
