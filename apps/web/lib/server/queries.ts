// Server-component data layer. Catalog reads go through apiFetch();
// remaining helpers still talk to Prisma directly.
import { Prisma } from "@prisma/client";
import { unstable_cache } from "next/cache";
import { prisma } from "./prisma";
import { apiFetch, qs } from "./api";

const VALID_DELIVERY = ["download", "email", "license_key", "streaming"] as const;
type DeliveryMethod = (typeof VALID_DELIVERY)[number];

function safeDelivery(v: string | undefined): DeliveryMethod | undefined {
  return VALID_DELIVERY.includes(v as DeliveryMethod) ? (v as DeliveryMethod) : undefined;
}

export async function getStats() {
  // Public counters: exclude soft-deletes; products gate on live store
  // too so /, /health, /admin all show the same number.
  const [sellers, products, orders, reviews] = await Promise.all([
    prisma.store.count(),
    prisma.product.count(),
    prisma.order.count(),
    prisma.productReview.count(),
  ]);
  return { sellers, products, orders, reviews };
}

/** Set of productIds the user has favourited — cheap lookup for hydrating
 *  FavoriteButton initial state on the browse / product detail / store pages. */
export async function getFavoriteSet(userId: number | null | undefined): Promise<Set<number>> {
  if (!userId) return new Set();
  const rows = await prisma.productFavorite.findMany({
    where: { userId },
    select: { productId: true },
  });
  return new Set(rows.map((r) => r.productId));
}

/** Full product cards for the /favorites page. Reuses the ProductCard
 *  shape so the existing <ProductCard> component renders it unchanged. */
export async function getFavoriteProducts(userId: number) {
  const faves = await prisma.productFavorite.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      product: {
        include: {
          store: { select: { name: true, storeId: true } },
          items: { select: { price: true, discountPercent: true } },
          images: { select: { productImage: true }, orderBy: { sortOrder: "asc" }, take: 1 },
          productNTags: { include: { tag: { select: { tagName: true } } } },
          reviews: { select: { rating: true } },
        },
      },
    },
  });
  return faves.map(({ product: p }) => {
    const prices = p.items.map((i) => Number(i.price));
    const ratings = p.reviews.map((r) => r.rating);
    const maxDiscount = p.items.reduce((m, it) => Math.max(m, it.discountPercent ?? 0), 0);
    return {
      productId: p.productId,
      name: p.name,
      description: p.description,
      image: p.images[0]?.productImage ?? `https://picsum.photos/seed/p${p.productId}/800/600`,
      minPrice: prices.length ? Math.min(...prices) : 0,
      maxPrice: prices.length ? Math.max(...prices) : 0,
      storeName: p.store.name,
      storeId: p.store.storeId,
      avgRating: ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : undefined,
      reviewCount: ratings.length,
      discountPercent: maxDiscount || undefined,
      tags: p.productNTags.map((nt) => nt.tag.tagName),
    };
  });
}

// Server endpoint hardcodes 8; slice client-side for smaller N.
export async function getFeaturedProducts(take = 8) {
  const items = await apiFetch<Array<Awaited<ReturnType<typeof apiFetch<unknown[]>>>[number]>>(
    "/products/featured",
  );
  return (items as any[]).slice(0, take);
}

// 8 product cards from sellers at sellerLevel ≥ 3, ranked by store rating
// + sellerLevel + reviews. Drives the "From top sellers" carousel on
// /browse — surfaces high-tier creators above the rest of the grid.
export async function getTopSellerProducts(take = 8) {
  type Row = {
    product_id: number; name: string; description: string;
    image: string | null;
    store_name: string; store_id: number;
    seller_level: number; rating: number;
    min_price: string;
  };
  const rows = await prisma.$queryRaw<Row[]>`
    SELECT
      p.product_id, p.name, p.description,
      (SELECT pi2.product_image FROM "product_image" pi2
        WHERE pi2.product_id = p.product_id
        ORDER BY pi2.sort_order ASC LIMIT 1) AS image,
      s.name        AS store_name,
      s.store_id    AS store_id,
      COALESCE(us.seller_level, 0) AS seller_level,
      s.rating      AS rating,
      COALESCE((
        SELECT MIN(price * (100 - COALESCE(discount_percent, 0)) / 100.0)::text
          FROM "product_item" WHERE product_id = p.product_id
      ), '0') AS min_price
    FROM "product" p
    JOIN "store"   s  ON s.store_id = p.store_id
    LEFT JOIN "user_stats" us ON us.user_id = s.owner_id
    WHERE p.is_active = true
      AND s.suspended_at IS NULL
      AND COALESCE(us.seller_level, 0) >= 3
    ORDER BY us.seller_level DESC NULLS LAST,
             s.rating DESC,
             (SELECT COUNT(*) FROM "product_review" pr WHERE pr.product_id = p.product_id) DESC
    LIMIT ${take}
  `;
  return rows.map((r) => ({
    productId: r.product_id,
    name: r.name,
    description: r.description,
    image: r.image ?? `https://picsum.photos/seed/p${r.product_id}/800/600`,
    minPrice: Number(r.min_price),
    storeName: r.store_name,
    storeId: r.store_id,
    sellerLevel: Number(r.seller_level),
    avgRating: r.rating > 0 ? r.rating / 10 : undefined,
  }));
}

// Featured stores ranked by owner's sellerLevel, then store rating, then
// recency. Promotes high-tier sellers on the landing page so newcomers
// see established storefronts first.
export async function getFeaturedStores(take = 4) {
  type Row = {
    store_id: number;
    name: string;
    profile_image: string | null;
    cover_image: string | null;
    description: string;
    created_at: Date;
    rating: number;
    seller_level: number;
    business_type_name: string;
    product_count: bigint;
  };
  const rows = await prisma.$queryRaw<Row[]>`
    SELECT
      s.store_id, s.name, s.profile_image, s.cover_image,
      s.description, s.created_at, s.rating,
      COALESCE(us.seller_level, 0) AS seller_level,
      bt.name AS business_type_name,
      (SELECT COUNT(*)::int FROM "product" p
        WHERE p.store_id = s.store_id AND p.deleted_at IS NULL) AS product_count
    FROM "store" s
    JOIN "business_type" bt ON bt.business_type_id = s.business_type_id
    LEFT JOIN "user_stats" us ON us.user_id = s.owner_id
    WHERE s.deleted_at IS NULL AND s.suspended_at IS NULL
    ORDER BY us.seller_level DESC NULLS LAST,
             s.rating DESC,
             s.created_at DESC
    LIMIT ${take}
  `;
  return rows.map((r) => ({
    storeId: r.store_id,
    name: r.name,
    profileImage: r.profile_image,
    coverImage: r.cover_image,
    description: r.description,
    createdAt: r.created_at,
    rating: r.rating,
    sellerLevel: Number(r.seller_level),
    businessType: { name: r.business_type_name },
    _count: { products: Number(r.product_count) },
  }));
}

// Featured coupons surfaced on the landing page — almost-expiring + scarce
// ones first, master coupons get a yellow ring (storeId IS NULL).
export async function getFeaturedCoupons(take = 6) {
  type Row = {
    coupon_id: number;
    code: string;
    store_id: number | null;
    store_name: string | null;
    discount_type: string;
    discount_value: number;
    usage_limit: number;
    used_count: bigint;
    end_date: Date;
  };
  const rows = await prisma.$queryRaw<Row[]>`
    SELECT
      c.coupon_id, c.code, c.store_id,
      s.name AS store_name,
      c.discount_type, c.discount_value, c.usage_limit, c.end_date,
      (SELECT COUNT(*)::int FROM "coupon_usage" cu WHERE cu.coupon_id = c.coupon_id) AS used_count
    FROM "coupon" c
    LEFT JOIN "store" s ON s.store_id = c.store_id
    WHERE c.is_active = true
      AND c.start_date <= NOW()
      AND c.end_date   >= NOW()
      AND (s.suspended_at IS NULL OR s.store_id IS NULL)
    ORDER BY (c.usage_limit - (
      SELECT COUNT(*) FROM "coupon_usage" cu WHERE cu.coupon_id = c.coupon_id
    )) ASC,
             c.end_date ASC
    LIMIT ${take}
  `;
  return rows.map((r) => ({
    couponId: r.coupon_id,
    code: r.code,
    storeId: r.store_id,
    storeName: r.store_name,
    discountType: r.discount_type as "percent" | "fixed",
    discountValue: r.discount_value,
    usageLimit: r.usage_limit,
    usedCount: Number(r.used_count),
    endDate: r.end_date,
    isMaster: r.store_id == null,
  }));
}

// Public store page envelope.
export async function getStore(storeId: number) {
  try {
    return await apiFetch<{
      store: any;
      products: any[];
      productCount: number;
      reviewCount: number;
      avgRating?: number;
    } | null>(`/stores/${storeId}`);
  } catch (err: any) {
    if (err?.status === 404) return null;
    throw err;
  }
}

/**
 * Products the user purchased (paid/fulfilled orders) but has NOT reviewed
 * yet — drives the "Things to review" section on /my-reviews (buyer view).
 */
export async function getPendingReviewProducts(userId: number) {
  const orderItems = await prisma.orderItem.findMany({
    where: {
      order: {
        userId,
        status: { in: ["paid", "fulfilled"] },
      },
    },
    select: {
      productItem: {
        select: {
          product: {
            select: {
              productId: true,
              name: true,
              images: { select: { productImage: true }, take: 1, orderBy: { sortOrder: "asc" } },
              store: { select: { name: true, storeId: true } },
            },
          },
        },
      },
    },
  });

  type ProductPayload = NonNullable<(typeof orderItems)[number]["productItem"]>["product"];
  const byId = new Map<number, ProductPayload>();
  for (const oi of orderItems) {
    if (!oi.productItem) continue;
    byId.set(oi.productItem.product.productId, oi.productItem.product);
  }
  const productIds = [...byId.keys()];
  if (productIds.length === 0) return [];

  const reviewed = await prisma.productReview.findMany({
    where: { userId, productId: { in: productIds } },
    select: { productId: true },
  });
  const reviewedSet = new Set(reviewed.map((r) => r.productId));
  return [...byId.values()].filter((p) => !reviewedSet.has(p.productId));
}

/** Reviews the current user authored — for /my-reviews (buyer view). */
export async function getReviewsByUser(userId: number) {
  return prisma.productReview.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      product: {
        select: {
          productId: true,
          name: true,
          images: { select: { productImage: true }, take: 1, orderBy: { sortOrder: "asc" } },
          store: { select: { name: true, storeId: true } },
        },
      },
    },
  });
}

/** Reviews on the seller's own products — for /my-reviews (seller view). */
export async function getReviewsForStore(storeId: number) {
  return prisma.productReview.findMany({
    where: { product: { storeId } },
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { firstName: true, lastName: true, profileImage: true, username: true } },
      product: {
        select: {
          productId: true,
          name: true,
          images: { select: { productImage: true }, take: 1, orderBy: { sortOrder: "asc" } },
        },
      },
    },
  });
}

// Reference data: cached for an hour. skipAuth so headers() doesn't
// run inside the unstable_cache scope (Next rejects dynamic sources there).
export const getCategories = unstable_cache(
  async () =>
    apiFetch<Array<{ categoryId: number; categoryName: string; description: string }>>(
      "/categories",
      { skipAuth: true },
    ),
  ["categories"],
  { revalidate: 3600, tags: ["categories"] },
);

export const getTags = unstable_cache(
  async () =>
    apiFetch<Array<{ tagId: number; tagName: string; tagDescription: string }>>(
      "/tags",
      { skipAuth: true },
    ),
  ["tags"],
  { revalidate: 3600, tags: ["tags"] },
);

export const getBusinessTypes = unstable_cache(
  async () => prisma.businessType.findMany({ orderBy: { name: "asc" } }),
  ["business-types"],
  { revalidate: 3600, tags: ["business-types"] },
);

// Country list for form dropdowns. Effectively static, cached.
export const getCountries = unstable_cache(
  async () =>
    prisma.country.findMany({
      select: { countryId: true, name: true },
      orderBy: { name: "asc" },
    }),
  ["countries"],
  { revalidate: 3600, tags: ["countries"] },
);

/**
 * Browse products. API handles filters/sort/paging/shaping. BFF still
 * owns the minRating HAVING-clause until Reviews migrates server-side.
 */
export async function browseProducts(params: {
  category?: number;
  tags?: string;
  minPrice?: number;
  maxPrice?: number;
  delivery?: string;
  q?: string;
  sort?: "newest" | "price_asc" | "price_desc" | "rating";
  page?: number;
  pageSize?: number;
  /** 1..5; minimum average review rating. Still BFF-side. */
  minRating?: number;
}) {
  const sort = params.sort ?? "newest";
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 16;

  const minRating = params.minRating && params.minRating > 0 ? params.minRating : null;

  // minRating is applied BFF-side below.
  const baseQuery = qs({
    category: params.category,
    tags: params.tags,
    minPrice: params.minPrice,
    maxPrice: params.maxPrice,
    delivery: safeDelivery(params.delivery),
    q: params.q,
    sort,
    page,
    pageSize,
  });

  type ApiResp = {
    items: Array<{
      productId: number;
      name: string;
      description: string;
      image: string;
      minPrice: number;
      maxPrice: number;
      storeName: string;
      storeId: number;
      avgRating?: number;
      reviewCount: number;
      discountPercent?: number;
      tags: string[];
    }>;
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };

  if (minRating === null) {
    return apiFetch<ApiResp>(`/products${baseQuery}`);
  }

  // minRating branch: resolve qualifying ids via raw SQL, then page.
  const where: Prisma.ProductWhereInput = {
    isActive: true,
  };
  if (params.category) where.categoryId = params.category;
  if (params.q) {
    where.OR = [
      { name: { contains: params.q, mode: "insensitive" } },
      { description: { contains: params.q, mode: "insensitive" } },
      { store: { name: { contains: params.q, mode: "insensitive" } } },
      { productNTags: { some: { tag: { tagName: { contains: params.q, mode: "insensitive" } } } } },
    ];
  }
  if (params.tags) {
    const tagIds = params.tags.split(",").map((s) => Number(s)).filter(Boolean);
    if (tagIds.length) where.productNTags = { some: { tagId: { in: tagIds } } };
  }
  const delivery = safeDelivery(params.delivery);
  if (params.minPrice !== undefined || params.maxPrice !== undefined || delivery) {
    where.items = {
      some: {
        ...(params.minPrice !== undefined ? { price: { gte: params.minPrice } } : {}),
        ...(params.maxPrice !== undefined ? { price: { lte: params.maxPrice } } : {}),
        ...(delivery ? { deliveryMethod: delivery } : {}),
      },
    };
  }
  const orderBy: Prisma.ProductOrderByWithRelationInput =
    sort === "newest"
      ? { createdAt: "desc" }
      : sort === "rating"
      ? { reviews: { _count: "desc" } }
      : sort === "price_asc"
      ? { productId: "asc" }
      : { productId: "desc" };

  const candidateRows = await prisma.product.findMany({
    where,
    orderBy,
    select: { productId: true },
  });
  if (candidateRows.length === 0) {
    return { items: [], page, pageSize, total: 0, totalPages: 1 };
  }
  const candidateIds = candidateRows.map((r) => r.productId);
  const ratingRows = await prisma.$queryRaw<Array<{ product_id: number }>>`
    SELECT product_id
      FROM product_review
     WHERE product_id IN (${Prisma.join(candidateIds)})
     GROUP BY product_id
    HAVING AVG(rating::float) >= ${minRating}
  `;
  const qualifyingIds = new Set(ratingRows.map((r) => Number(r.product_id)));
  if (qualifyingIds.size === 0) {
    return { items: [], page, pageSize, total: 0, totalPages: 1 };
  }

  const effectiveWhere: Prisma.ProductWhereInput = {
    ...where,
    productId: { in: [...qualifyingIds] },
  };

  const [rows, total] = await Promise.all([
    prisma.product.findMany({
      where: effectiveWhere,
      orderBy,
      take: pageSize,
      skip: (page - 1) * pageSize,
      include: {
        store: { select: { name: true, storeId: true } },
        items: { select: { price: true, discountPercent: true } },
        images: { select: { productImage: true }, orderBy: { sortOrder: "asc" }, take: 1 },
        productNTags: { include: { tag: { select: { tagName: true } } } },
        reviews: { select: { rating: true } },
      },
    }),
    prisma.product.count({ where: effectiveWhere }),
  ]);

  const items = rows.map((p) => {
    const prices = p.items.map((i) => Number(i.price));
    const ratings = p.reviews.map((r) => r.rating);
    const maxDiscount = p.items.reduce((m, it) => Math.max(m, it.discountPercent ?? 0), 0);
    return {
      productId: p.productId,
      name: p.name,
      description: p.description,
      image: p.images[0]?.productImage ?? `https://picsum.photos/seed/p${p.productId}/800/600`,
      minPrice: prices.length ? Math.min(...prices) : 0,
      maxPrice: prices.length ? Math.max(...prices) : 0,
      storeName: p.store.name,
      storeId: p.store.storeId,
      avgRating: ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : undefined,
      reviewCount: ratings.length,
      discountPercent: maxDiscount || undefined,
      tags: p.productNTags.map((nt) => nt.tag.tagName),
    };
  });

  if (sort === "price_asc") items.sort((a, b) => a.minPrice - b.minPrice);
  if (sort === "price_desc") items.sort((a, b) => b.minPrice - a.minPrice);

  return {
    items,
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

// Product detail. BFF-direct until Reviews moves server-side.
// also gate `isActive` and `store.suspendedAt` so paused
// products + suspended stores can't be reached by direct URL. The
// rating/count aggregate now uses `_count` + `_avg.rating` instead of
// counting the `take: 5` review preview list (which capped reviewCount
// at 5 even for products with hundreds of reviews and skewed avg
// toward whichever 5 reviews happened to be newest).
export async function getProduct(id: number) {
  const product = await prisma.product.findFirst({
    where: {
      productId: id,
      isActive: true,
      store: { suspendedAt: null },
    },
    include: {
      store: {
        select: {
          storeId: true,
          ownerId: true,
          name: true,
          profileImage: true,
          businessType: { select: { name: true } },
        },
      },
      category: true,
      items: { orderBy: { price: "asc" } },
      images: { orderBy: { sortOrder: "asc" } },
      productNTags: { include: { tag: true } },
      reviews: {
        orderBy: { createdAt: "desc" },
        take: 5,
        include: {
          // userId for the edit/delete affordance on the review.
          user: { select: { userId: true, firstName: true, lastName: true, profileImage: true, username: true } },
        },
      },
    },
  });
  if (!product) return null;
  const aggregate = await prisma.productReview.aggregate({
    where: { productId: id },
    _count: { _all: true },
    _avg: { rating: true },
  });
  const reviewCount = aggregate._count?._all ?? 0;
  const avgRating =
    aggregate._avg?.rating !== null && aggregate._avg?.rating !== undefined
      ? Number(aggregate._avg.rating)
      : undefined;
  return { ...product, avgRating, reviewCount };
}

/**
 * return the orderId of the user's most recent paid /
 * fulfilled / pending order containing this product, or `null`.
 * Used by the product page to swap the buy buttons for an
 * "✓ Already in your library" banner when the product is
 * non-stackable. Refunded + cancelled orders are excluded so a
 * buyer can re-purchase after a refund.
 */
export async function getOwnedOrderId(
  userId: number,
  productId: number,
): Promise<number | null> {
  // Only paid/fulfilled count as "already owned". A pending order isn't a
  // purchase yet — treating it as owned hides the buy box on the product
  // page and traps the buyer in the pending order if Stripe didn't go
  // through.
  const owned = await prisma.order.findFirst({
    where: {
      userId,
      status: { in: ["paid", "fulfilled"] },
      items: { some: { productItem: { productId } } },
    },
    select: { orderId: true },
    orderBy: { createdAt: "desc" },
  });
  return owned?.orderId ?? null;
}

// More like this: same category and shared tags, excludes self.
//
// Two-stage query for efficiency + clean typing:
//   1. Raw SQL ranks candidate productIds by a hand-written scoring
//      formula (category match weighted 10x, shared tag count weighted
//      1x, review count as tie-breaker). CTE + correlated subqueries +
//      ARRAY containment via ANY. This is the kind of recommendation
//      query Prisma's builder can't express without N+1 round-trips.
//   2. Prisma hydrates the top-N IDs into typed Product rows with
//      nested store/items/images/tags — Prisma is genuinely better
//      here because the hydration is a fan-out the SQL builder would
//      have to assemble manually.
//
// Indexes used:
//   - product(category_id) for the category match
//   - product_n_tag(product_id, tag_id) composite for shared-tag count
//   - product_review(product_id) for the review-count tie-breaker
export async function getRelatedProducts(productId: number, take = 4) {
  const ranked = await prisma.$queryRaw<Array<{ product_id: number }>>`
    WITH source AS (
      SELECT p.category_id,
             ARRAY_AGG(DISTINCT pnt.tag_id) FILTER (WHERE pnt.tag_id IS NOT NULL) AS tag_ids
        FROM "product" p
        LEFT JOIN "product_n_tag" pnt ON pnt.product_id = p.product_id
       WHERE p.product_id = ${productId}
       GROUP BY p.category_id
    ),
    candidates AS (
      SELECT
        p.product_id,
        CASE WHEN p.category_id = (SELECT category_id FROM source) THEN 1 ELSE 0 END AS category_match,
        COALESCE(
          (SELECT COUNT(*)::int FROM "product_n_tag" x
            WHERE x.product_id = p.product_id
              AND x.tag_id = ANY((SELECT tag_ids FROM source))),
          0
        ) AS shared_tags,
        (SELECT COUNT(*)::int FROM "product_review" r
          WHERE r.product_id = p.product_id) AS review_count
      FROM "product" p
      JOIN "store" s ON s.store_id = p.store_id
      WHERE p.is_active = true
        AND p.deleted_at IS NULL
        AND s.deleted_at IS NULL
        AND s.suspended_at IS NULL
        AND p.product_id <> ${productId}
    )
    SELECT product_id
      FROM candidates
     WHERE category_match = 1 OR shared_tags > 0
     ORDER BY (category_match * 10 + shared_tags) DESC, review_count DESC
     LIMIT ${take}
  `;
  if (ranked.length === 0) return [];
  const ids = ranked.map((r) => r.product_id);

  const products = await prisma.product.findMany({
    where: { productId: { in: ids } },
    include: {
      store: { select: { name: true, storeId: true } },
      items: { select: { price: true, discountPercent: true } },
      images: { select: { productImage: true }, orderBy: { sortOrder: "asc" }, take: 1 },
      productNTags: { include: { tag: { select: { tagName: true } } } },
      reviews: { select: { rating: true } },
    },
  });
  // Preserve the SQL's ranking order — Prisma's `findMany` returns rows
  // by PK, not in `ids`'s sort order. Re-key by id and walk `ids` to
  // emit them ranked.
  const byId = new Map(products.map((p) => [p.productId, p]));
  const ordered = ids.map((id) => byId.get(id)).filter((p): p is NonNullable<typeof p> => p != null);
  return ordered.map((p) => {
    const prices = p.items.map((i) => Number(i.price));
    const ratings = p.reviews.map((r) => r.rating);
    const maxDiscount = p.items.reduce((m, it) => Math.max(m, it.discountPercent ?? 0), 0);
    return {
      productId: p.productId,
      name: p.name,
      description: p.description,
      image: p.images[0]?.productImage ?? `https://picsum.photos/seed/p${p.productId}/800/600`,
      minPrice: prices.length ? Math.min(...prices) : 0,
      maxPrice: prices.length ? Math.max(...prices) : 0,
      storeName: p.store.name,
      storeId: p.store.storeId,
      avgRating: ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : undefined,
      reviewCount: ratings.length,
      discountPercent: maxDiscount || undefined,
      tags: p.productNTags.map((nt) => nt.tag.tagName),
    };
  });
}

/**
 * Distinct buyers in the last `days`. Used by the social-proof line.
 * Returns 0 when no rows so the UI can hide the line.
 */
export async function getRecentPurchaseCount(productId: number, days = 7): Promise<number> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  // Distinct by userId so repeated orders count once.
  const rows = await prisma.orderItem.findMany({
    where: {
      productItem: { productId },
      order: {
        status: { in: ["paid", "fulfilled"] },
        createdAt: { gte: since },
      },
    },
    select: { order: { select: { userId: true } } },
  });
  return new Set(rows.map((r) => r.order.userId)).size;
}

// Admin store list. Direct Prisma to skip the same-host HTTP hop.
export async function getAdminStores() {
  return prisma.store.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      owner: { select: { username: true, firstName: true, lastName: true, profileImage: true } },
      businessType: true,
      _count: {
        select: { products: true },
      },
    },
  });
}
