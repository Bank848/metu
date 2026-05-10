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

// Public counter set used on `/` hero. Cache 60s so a hard refresh
// within a minute doesn't re-count the four tables — single biggest
// SSR cost on the home page.
export const getStats = unstable_cache(
  async () => {
    const [sellers, products, orders, reviews] = await Promise.all([
      prisma.store.count(),
      prisma.product.count(),
      prisma.order.count(),
      prisma.productReview.count(),
    ]);
    return { sellers, products, orders, reviews };
  },
  ["public-stats"],
  { revalidate: 60, tags: ["public-stats"] },
);

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
// Card-shape derivation: each variant's post-discount price is
// price * (100 - discountPercent) / 100. min/maxPrice are over those;
// originalMin/Max use raw prices and only surface when there's a real
// discount so ProductCard can render the strikethrough.
type CardShape = {
  minPrice: number;
  maxPrice: number;
  originalMinPrice?: number;
  originalMaxPrice?: number;
  discountPercent?: number;
};
export function shapeCardPrices(items: Array<{ price: unknown; discountPercent: number | null }>): CardShape {
  if (items.length === 0) return { minPrice: 0, maxPrice: 0 };
  const raw = items.map((i) => Number(i.price));
  const post = items.map((i) => Number(i.price) * (100 - (i.discountPercent ?? 0)) / 100);
  const maxDiscount = items.reduce((m, it) => Math.max(m, it.discountPercent ?? 0), 0);
  return {
    minPrice: Math.round(Math.min(...post)),
    maxPrice: Math.round(Math.max(...post)),
    originalMinPrice: maxDiscount > 0 ? Math.round(Math.min(...raw)) : undefined,
    originalMaxPrice: maxDiscount > 0 ? Math.round(Math.max(...raw)) : undefined,
    discountPercent: maxDiscount || undefined,
  };
}

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
}

// Server endpoint hardcodes 8; slice client-side for smaller N.
// Cache 5 min — featured list is hand-curated by sales count, not
// real-time data, so SSR cost can be amortised across many home views.
export const getFeaturedProducts = unstable_cache(
  async (take = 8) => {
    const items = await apiFetch<Array<Awaited<ReturnType<typeof apiFetch<unknown[]>>>[number]>>(
      "/products/featured",
      { skipAuth: true },
    );
    return (items as any[]).slice(0, take);
  },
  ["featured-products"],
  { revalidate: 300, tags: ["featured-products"] },
);

// Top-sellers grid on /browse top section. Heavy SQL with 6 subqueries
// per product. Cache 5 min — list is gated on seller_level >= 3 which
// shifts only on payout/onboarding events.
export const getTopSellerProducts = unstable_cache(
  _getTopSellerProductsImpl,
  ["top-seller-products"],
  { revalidate: 300, tags: ["top-seller-products"] },
);

async function _getTopSellerProductsImpl(take = 8) {
  type Row = {
    product_id: number;
    name: string;
    description: string;
    image: string | null;
    store_name: string;
    store_id: number;
    store_image: string | null,
    seller_level: number;
    rating: number;
    review_count: number;
    min_price: string;
    max_price: string;
    min_price_original: string;
    max_price_original: string;
    max_discount: number;
    tags: string;
  };

  const rows = await prisma.$queryRaw<Row[]>`
    SELECT
      p.product_id,
      p.name,
      p.description,
      (
        SELECT pi2.product_image FROM "product_image" pi2
        WHERE pi2.product_id = p.product_id
        ORDER BY pi2.sort_order ASC LIMIT 1
      ) AS image,
      s.name     AS store_name,
      s.store_id AS store_id,
      s.profile_image AS store_image,
      COALESCE(us.seller_level, 0) AS seller_level,
      s.rating AS rating,
      (SELECT COUNT(*) FROM "product_review" pr WHERE pr.product_id = p.product_id)::int AS review_count,
      COALESCE((
        SELECT MIN(price * (100 - COALESCE(discount_percent, 0)) / 100.0)::text
        FROM "product_item" WHERE product_id = p.product_id
      ), '0') AS min_price,
      COALESCE((
        SELECT MAX(price * (100 - COALESCE(discount_percent, 0)) / 100.0)::text
        FROM "product_item" WHERE product_id = p.product_id
      ), '0') AS max_price,
      COALESCE((
        SELECT MIN(price)::text FROM "product_item" WHERE product_id = p.product_id
      ), '0') AS min_price_original,
      COALESCE((
        SELECT MAX(price)::text FROM "product_item" WHERE product_id = p.product_id
      ), '0') AS max_price_original,
      COALESCE((
        SELECT MAX(COALESCE(discount_percent, 0)) FROM "product_item" WHERE product_id = p.product_id
      ), 0) AS max_discount,
      COALESCE((
        SELECT STRING_AGG(t.tag_name, ',')
        FROM "product_n_tag" pnt
        JOIN "product_tag" t ON t.tag_id = pnt.tag_id
        WHERE pnt.product_id = p.product_id
      ), '') AS tags
    FROM "product" p
    JOIN "store" s ON s.store_id = p.store_id
    LEFT JOIN "user_stats" us ON us.user_id = s.owner_id
    WHERE p.is_active = true
      AND s.suspended_at IS NULL
      AND COALESCE(us.seller_level, 0) >= 3
    ORDER BY
      us.seller_level DESC NULLS LAST,
      s.rating DESC,
      review_count DESC
    LIMIT ${take}
  `;

  return rows.map((r) => ({
    productId: r.product_id,
    name: r.name,
    description: r.description,
    image: r.image ?? `https://picsum.photos/seed/p${r.product_id}/800/600`,
    minPrice: Number(r.min_price),
    maxPrice: Number(r.max_price),
    originalMinPrice: Number(r.min_price_original),
    originalMaxPrice: Number(r.max_price_original),
    storeName: r.store_name,
    storeId: r.store_id,
    storeImage: r.store_image,
    sellerLevel: Number(r.seller_level),
    avgRating: r.rating > 0 ? r.rating / 10 : undefined,
    reviewCount: Number(r.review_count),
    discountPercent: r.max_discount > 0 ? r.max_discount : undefined,
    tags: r.tags ? r.tags.split(",").filter(Boolean) : [],
  }));
}

// Home featured-stores carousel. Cache 5 min — top stores by
// seller_level / rating shift slowly.
export const getFeaturedStores = unstable_cache(
  _getFeaturedStoresImpl,
  ["featured-stores"],
  { revalidate: 300, tags: ["featured-stores"] },
);

async function _getFeaturedStoresImpl(take = 4) {
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
        WHERE p.store_id = s.store_id) AS product_count
    FROM "store" s
    JOIN "business_type" bt ON bt.type_id = s.business_type_id
    LEFT JOIN "user_stats" us ON us.user_id = s.owner_id
    WHERE s.suspended_at IS NULL
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


// Active-coupon strip on /. Cache 60s — short TTL because coupons can
// expire mid-day and we want to drop them from the strip promptly.
export const getFeaturedCoupons = unstable_cache(
  _getFeaturedCouponsImpl,
  ["featured-coupons"],
  { revalidate: 60, tags: ["featured-coupons"] },
);

async function _getFeaturedCouponsImpl(take = 6) {
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

// Public store page envelope. Cached 5 min — store profile + product list
// changes on seller mutations (rare during a demo window).
export const getStore = unstable_cache(
  _getStoreImpl,
  ["store"],
  { revalidate: 300, tags: ["store"] },
);

async function _getStoreImpl(storeId: number) {
  try {
    // skipAuth keeps headers() out of the unstable_cache scope. The
    // /stores/:id endpoint is public-read so dropping cookies is safe.
    return await apiFetch<{
      store: any;
      products: any[];
      productCount: number;
      reviewCount: number;
      avgRating?: number;
    } | null>(`/stores/${storeId}`, { skipAuth: true });
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
    apiFetch<Array<{ tagId: number; tagName: string; tagDescription: string; productCount: number }>>(
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

type BrowseParams = {
  category?: number;
  tags?: string;
  minPrice?: number;
  maxPrice?: number;
  originalMinPrice?: number;
  originalMaxPrice?: number;
  delivery?: string;
  q?: string;
  shop?: string;
  sort?: "newest" | "price_asc" | "price_desc" | "rating";
  page?: number;
  pageSize?: number;
  minRating?: number;
};

// Heavy raw SQL with 5+ subqueries per row. unstable_cache auto-keys by
// args, so each unique filter combo gets its own entry. 120s TTL keeps
// cache cardinality bounded if filter combos explode.
export const browseProducts = unstable_cache(
  _browseProductsImpl,
  ["browse-products"],
  { revalidate: 120, tags: ["browse-products"] },
);

async function _browseProductsImpl(params: BrowseParams) {
  const sort = params.sort ?? "newest";
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 16;
  const offset = (page - 1) * pageSize;
  const delivery = safeDelivery(params.delivery);

  const conditions: Prisma.Sql[] = [
    Prisma.sql`p.is_active = true`,
  ];

  if (params.category !== undefined)
    conditions.push(Prisma.sql`p.category_id = ${params.category}`);

  if (params.shop) {
    // Escape SQL-LIKE meta-chars so a typed `%` or `_` doesn't become a
    // server-side wildcard cardinality amplifier.
    const safe = params.shop.trim().replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
    const shopLike = `%${safe}%`;
    conditions.push(Prisma.sql`s.name ILIKE ${shopLike} ESCAPE '\\'`);
  }

  if (params.q) {
    const safeQ = params.q.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
    const like = `%${safeQ}%`;
    conditions.push(Prisma.sql`(
      p.name        ILIKE ${like} ESCAPE '\\' OR
      p.description ILIKE ${like} ESCAPE '\\' OR
      s.name        ILIKE ${like} ESCAPE '\\' OR
      EXISTS (
        SELECT 1 FROM "product_n_tag" pnt2
        JOIN  "product_tag"   t2 ON t2.tag_id = pnt2.tag_id
        WHERE pnt2.product_id = p.product_id
          AND t2.tag_name ILIKE ${like} ESCAPE '\\'
      )
    )`);
  }

  if (params.tags) {
    const tagIds = params.tags.split(",").map(Number).filter(Boolean);
    if (tagIds.length) {
      conditions.push(Prisma.sql`EXISTS (
        SELECT 1 FROM "product_n_tag" pnt3
        WHERE pnt3.product_id = p.product_id
          AND pnt3.tag_id IN (${Prisma.join(tagIds)})
      )`);
    }
  }

  // Price / delivery filters operate on product_item rows
  const itemConditions: Prisma.Sql[] = [];

  if (params.minPrice !== undefined)
    itemConditions.push(Prisma.sql`price * (100 - COALESCE(discount_percent, 0)) / 100.0 >= ${params.minPrice}`);
  if (params.maxPrice !== undefined)
    itemConditions.push(Prisma.sql`price * (100 - COALESCE(discount_percent, 0)) / 100.0 <= ${params.maxPrice}`);
  if (params.originalMinPrice !== undefined)
    itemConditions.push(Prisma.sql`price >= ${params.originalMinPrice}`);
  if (params.originalMaxPrice !== undefined)
    itemConditions.push(Prisma.sql`price <= ${params.originalMaxPrice}`);
  if (delivery)
    itemConditions.push(Prisma.sql`delivery_method = ${delivery}::"DeliveryMethod"`);

  if (itemConditions.length) {
    conditions.push(Prisma.sql`EXISTS (
      SELECT 1 FROM "product_item" pi_f
      WHERE pi_f.product_id = p.product_id
        AND ${Prisma.join(itemConditions, " AND ")}
    )`);
  }

  if (params.minRating && params.minRating > 0) {
    conditions.push(Prisma.sql`(
      SELECT AVG(rating::float) FROM "product_review"
      WHERE product_id = p.product_id
    ) >= ${params.minRating}`);
  }

  const whereClause = Prisma.join(conditions, " AND ");

  // ---------- ORDER BY ----------
  const orderByClause =
    sort === "newest"    ? Prisma.sql`p.created_at DESC` :
    sort === "price_asc" ? Prisma.sql`min_price ASC`     :
    sort === "price_desc"? Prisma.sql`min_price DESC`    :
    /* rating */           Prisma.sql`review_count DESC` ;

  // ---------- main query ----------
  type Row = {
    product_id: number;
    name: string;
    description: string;
    image: string | null;
    store_name: string;
    store_id: number;
    store_image: string | null;
    avg_rating: number | null;
    review_count: number;
    min_price: string;
    max_price: string;
    min_price_original: string;
    max_price_original: string;
    max_discount: number;
    tags: string;
    total_count: string; // COUNT(*) OVER () — comes back as string from raw query
  };

  const rows = await prisma.$queryRaw<Row[]>`
    SELECT
      p.product_id,
      p.name,
      p.description,
      (
        SELECT pi2.product_image FROM "product_image" pi2
        WHERE  pi2.product_id = p.product_id
        ORDER  BY pi2.sort_order ASC LIMIT 1
      ) AS image,
      s.name     AS store_name,
      s.store_id AS store_id,
      s.profile_image AS store_image,
      (
        SELECT AVG(rating::float) FROM "product_review"
        WHERE  product_id = p.product_id
      ) AS avg_rating,
      (
        SELECT COUNT(*) FROM "product_review"
        WHERE  product_id = p.product_id
      )::int AS review_count,
      COALESCE((
        SELECT MIN(price * (100 - COALESCE(discount_percent, 0)) / 100.0)::text
        FROM   "product_item" WHERE product_id = p.product_id
      ), '0') AS min_price,
      COALESCE((
        SELECT MAX(price * (100 - COALESCE(discount_percent, 0)) / 100.0)::text
        FROM   "product_item" WHERE product_id = p.product_id
      ), '0') AS max_price,
      COALESCE((
        SELECT MIN(price)::text FROM "product_item" WHERE product_id = p.product_id
      ), '0') AS min_price_original,
      COALESCE((
        SELECT MAX(price)::text FROM "product_item" WHERE product_id = p.product_id
      ), '0') AS max_price_original,
      COALESCE((
        SELECT MAX(COALESCE(discount_percent, 0))
        FROM   "product_item" WHERE product_id = p.product_id
      ), 0) AS max_discount,
      COALESCE((
        SELECT STRING_AGG(t.tag_name, ',')
        FROM   "product_n_tag" pnt
        JOIN   "product_tag"   t ON t.tag_id = pnt.tag_id
        WHERE  pnt.product_id = p.product_id
      ), '') AS tags,
      COUNT(*) OVER () AS total_count
    FROM  "product" p
    JOIN  "store"   s ON s.store_id = p.store_id
    WHERE ${whereClause}
    ORDER BY ${orderByClause}
    LIMIT  ${pageSize}
    OFFSET ${offset}
  `;

  if (rows.length === 0) {
    return { items: [], page, pageSize, total: 0, totalPages: 1 };
  }

  const total = Number(rows[0].total_count);

  const items = rows.map((r) => ({
    productId: r.product_id,
    name: r.name,
    description: r.description,
    image: r.image ?? `https://picsum.photos/seed/p${r.product_id}/800/600`,
    minPrice: Number(r.min_price),
    maxPrice: Number(r.max_price),
    originalMinPrice: Number(r.min_price_original),
    originalMaxPrice: Number(r.max_price_original),
    storeName: r.store_name,
    storeId: r.store_id,
    storeImage: r.store_image,
    avgRating: r.avg_rating != null ? r.avg_rating : undefined,
    reviewCount: Number(r.review_count),
    discountPercent: r.max_discount > 0 ? r.max_discount : undefined,
    tags: r.tags ? r.tags.split(",").filter(Boolean) : [],
  }));

  return {
    items,
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

// Product detail — 10+ logical operations per call. Cache 5 min.
// Tag is static; revalidateTag('product') invalidates ALL product caches
// on any product mutation (acceptable: writes are infrequent vs reads).
export const getProduct = unstable_cache(
  _getProductImpl,
  ["product"],
  { revalidate: 300, tags: ["product"] },
);

async function _getProductImpl(id: number) {
  // Run the heavy include and the review aggregate in parallel — they
  // don't depend on each other (both keyed by productId). Saves one
  // Singapore→Singapore Postgres round-trip on cold cache hits.
  const [product, aggregate] = await Promise.all([
    prisma.product.findFirst({
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
        details: true,
        category: true,
        // Allowlist — keep deliveryUrl + licenseKeyTemplate out of the
        // RSC Flight payload (mirrors the public API DTO).
        items: {
          orderBy: { price: "asc" },
          select: {
            productItemId: true,
            productId: true,
            name: true,
            description: true,
            image: true,
            deliveryMethod: true,
            quantity: true,
            price: true,
            discountPercent: true,
            discountAmount: true,
            createdDate: true,
          },
        },
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
    }),
    prisma.productReview.aggregate({
      where: { productId: id },
      _count: { _all: true },
      _avg: { rating: true },
    }),
  ]);
  if (!product) return null;
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
// "More like this" sidebar on /product/[id]. Cached 10 min — ranking
// shifts only on new products / reviews in the same category.
export const getRelatedProducts = unstable_cache(
  _getRelatedProductsImpl,
  ["related-products"],
  { revalidate: 600, tags: ["product"] },
);

async function _getRelatedProductsImpl(productId: number, take = 4) {
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
        -- Use IN + unnest to flatten the int[] subquery — Postgres is
        -- strict about ANY((subquery)) when the subquery returns one
        -- row containing an array (parses as integer = integer[]).
        -- IN + unnest sidesteps that ambiguity entirely.
        COALESCE(
          (SELECT COUNT(*)::int FROM "product_n_tag" x
            WHERE x.product_id = p.product_id
              AND x.tag_id IN (SELECT unnest(tag_ids) FROM source)),
          0
        ) AS shared_tags,
        (SELECT COUNT(*)::int FROM "product_review" r
          WHERE r.product_id = p.product_id) AS review_count
      FROM "product" p
      JOIN "store" s ON s.store_id = p.store_id
      WHERE p.is_active = true
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
}

/**
 * Distinct buyers in the last `days`. Used by the social-proof line.
 * Returns 0 when no rows so the UI can hide the line.
 */
export const getRecentPurchaseCount = unstable_cache(
  _getRecentPurchaseCountImpl,
  ["recent-purchase-count"],
  { revalidate: 300, tags: ["recent-purchase-count"] },
);

async function _getRecentPurchaseCountImpl(productId: number, days = 7): Promise<number> {
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

// Admin store list with optional filters + revenue insight per store.
// Filters: search by store/owner name, business type, rating range, min
// product count. Returns the same shape as before plus `revenue` so the
// admin page can show "฿X total" inline. 20 rows per page.
export interface AdminStoresFilters {
  q?: string;
  businessTypeId?: number;
  minRating?: number;
  minProducts?: number;
  page?: number;
}
export async function getAdminStores(f: AdminStoresFilters = {}) {
  const page = Math.max(1, f.page ?? 1);
  const pageSize = 20;
  const where: Prisma.StoreWhereInput = {};
  if (f.businessTypeId) where.businessTypeId = f.businessTypeId;
  if (f.minRating !== undefined) where.rating = { gte: f.minRating };
  if (f.q?.trim()) {
    // Cap at 64 chars before fanning into multiple `contains` clauses.
    const q = f.q.trim().slice(0, 64);
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { owner: { OR: [
        { username: { contains: q, mode: "insensitive" } },
        { firstName: { contains: q, mode: "insensitive" } },
        { lastName: { contains: q, mode: "insensitive" } },
      ] } },
    ];
  }
  const [rows, total] = await Promise.all([
    prisma.store.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        owner: { select: { username: true, firstName: true, lastName: true, profileImage: true } },
        businessType: true,
        _count: { select: { products: true } },
      },
    }),
    prisma.store.count({ where }),
  ]);
  // Apply minProducts in memory because Prisma can't filter on _count
  // directly; we still page in DB so the slice we filter is bounded.
  const filtered = f.minProducts
    ? rows.filter((s) => s._count.products >= f.minProducts!)
    : rows;
  // Per-store revenue (one extra raw-SQL roll-up). Empty stores get 0.
  const ids = filtered.map((s) => s.storeId);
  const revenueMap = new Map<number, number>();
  if (ids.length > 0) {
    const rev = await prisma.$queryRaw<Array<{ store_id: number; revenue: string }>>`
      SELECT s.store_id,
             COALESCE(SUM(oi.price_per_unit * oi.quantity), 0)::text AS revenue
        FROM store s
        LEFT JOIN product      p  ON p.store_id        = s.store_id
        LEFT JOIN product_item pi ON pi.product_id     = p.product_id
        LEFT JOIN order_item   oi ON oi.product_item_id = pi.product_item_id
        LEFT JOIN orders       o  ON o.order_id        = oi.order_id
                                  AND o.status IN ('paid','fulfilled')
        WHERE s.store_id IN (${Prisma.join(ids)})
        GROUP BY s.store_id
    `;
    for (const r of rev) revenueMap.set(r.store_id, Number(r.revenue));
  }
  return {
    items: filtered.map((s) => ({ ...s, revenue: revenueMap.get(s.storeId) ?? 0 })),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export type AdminOrdersFilters = {
  q?: string;
  status?: "pending" | "paid" | "fulfilled" | "cancelled" | "refunded";
  storeId?: number;
  page?: number;
};

/**
 * /admin/orders — list every order across every store. Joined buyer +
 * line items + first store name so the table can show seller chip
 * without N+1. Capped at 50 rows / page.
 */
export async function getAdminOrders(f: AdminOrdersFilters = {}) {
  const page = Math.max(1, f.page ?? 1);
  const pageSize = 50;
  const where: Prisma.OrderWhereInput = {};
  if (f.status) where.status = f.status;
  if (f.storeId) {
    where.items = { some: { productItem: { product: { storeId: f.storeId } } } };
  }
  if (f.q?.trim()) {
    // Defense-in-depth: cap the search string at 64 chars before it
    // flows into multiple `contains` clauses on indexed text columns.
    // Admin-only today, but a future change that ever masked email in
    // the rendered list would otherwise leave the timing oracle.
    const q = f.q.trim().slice(0, 64);
    const orderId = Number.isFinite(Number(q)) ? Number(q) : undefined;
    where.OR = [
      ...(orderId ? [{ orderId }] : []),
      { user: { username: { contains: q, mode: "insensitive" } } },
      { user: { email: { contains: q, mode: "insensitive" } } },
      { user: { firstName: { contains: q, mode: "insensitive" } } },
      { user: { lastName: { contains: q, mode: "insensitive" } } },
    ];
  }
  const [rows, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        user: { select: { username: true, firstName: true, lastName: true, email: true } },
        items: {
          include: {
            productItem: {
              select: {
                product: { select: { name: true, store: { select: { storeId: true, name: true } } } },
              },
            },
          },
        },
      },
    }),
    prisma.order.count({ where }),
  ]);
  return {
    items: rows,
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export type AdminAuditLogFilters = {
  actorEmail?: string;
  action?: string;
  outcome?: string;
  from?: Date;
  to?: Date;
  page?: number;
};

/**
 * /admin/audit-log — paginated tail of audit_log with optional
 * actor / action / outcome / date filters. 100 rows / page.
 * actorEmail filters by joining User on actor_user_id.
 */
export async function getAdminAuditLog(f: AdminAuditLogFilters = {}) {
  const page = Math.max(1, f.page ?? 1);
  const pageSize = 100;
  const where: Prisma.AuditLogWhereInput = {};
  // Cap action filter at 64 chars before it hits a startsWith index
  // scan — defense-in-depth against unbounded input on this admin
  // endpoint.
  if (f.action) where.action = { startsWith: f.action.slice(0, 64) };
  if (f.outcome) {
    // Stored under meta.outcome historically; also accept tag suffix on action.
    where.OR = [
      { action: { endsWith: `.${f.outcome.slice(0, 64)}` } },
      { meta: { path: ["outcome"], equals: f.outcome.slice(0, 64) } },
    ];
  }
  if (f.from || f.to) {
    // Cap the date range at 90 days to prevent an unbounded full-table
    // scan on audit_log. If the caller asks for more, clamp `from` so
    // the window slides to the most recent 90 days ending at `to`.
    const MAX_RANGE_MS = 90 * 24 * 60 * 60 * 1000;
    let from = f.from;
    const to = f.to;
    if (from && to && to.getTime() - from.getTime() > MAX_RANGE_MS) {
      from = new Date(to.getTime() - MAX_RANGE_MS);
    }
    where.createdAt = {};
    if (from) where.createdAt.gte = from;
    if (to) where.createdAt.lte = to;
  }
  if (f.actorEmail?.trim()) {
    // Cap actorEmail at 64 chars before the `contains` join scan.
    const e = f.actorEmail.trim().slice(0, 64);
    where.actor = {
      is: { email: { contains: e, mode: "insensitive" } },
    };
  }
  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        actor: { select: { username: true, email: true, firstName: true, lastName: true } },
      },
    }),
    prisma.auditLog.count({ where }),
  ]);
  return {
    items: rows,
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}
