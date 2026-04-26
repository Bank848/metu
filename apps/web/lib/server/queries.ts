/**
 * Direct Prisma queries used by server components — bypasses HTTP round-trip
 * to /api routes (which fails on Vercel preview URLs that have deployment
 * protection, and is generally faster).
 */
import { Prisma } from "@prisma/client";
import { unstable_cache } from "next/cache";
import { prisma } from "./prisma";

const VALID_DELIVERY = ["download", "email", "license_key", "streaming"] as const;
type DeliveryMethod = (typeof VALID_DELIVERY)[number];

function safeDelivery(v: string | undefined): DeliveryMethod | undefined {
  return VALID_DELIVERY.includes(v as DeliveryMethod) ? (v as DeliveryMethod) : undefined;
}

export async function getStats() {
  // Public counters — exclude soft-deleted rows so the homepage never shows
  // a number that includes ghosts.
  //
  // Phase 11 / F10 (CEO Decision 3) — the "Sellers" tile previously
  // counted `UserStats.role = seller` (i.e. "users with the seller
  // role") which diverged from `/health` and `/admin` (both of which
  // count `Store` rows). Unify on `Store.count` so the same number
  // appears on every counter surface; the human-facing "Sellers" label
  // stays unchanged because each store has exactly one owner.
  //
  // Phase 11 run #2 / F14 (CEO Decision 2) — the products tile used to
  // count every non-deleted product, but `/admin/stores` summed only
  // products that belong to live stores (off-by-one when one product
  // sat under a soft-deleted store). Match the admin view here so home,
  // /health, /admin overview, and /admin/stores all read the same
  // number. Counts now reflect what an admin can act on.
  const [sellers, products, orders, reviews] = await Promise.all([
    prisma.store.count({ where: { deletedAt: null } }),
    prisma.product.count({ where: { deletedAt: null, store: { deletedAt: null } } }),
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

export async function getFeaturedProducts(take = 8) {
  const products = await prisma.product.findMany({
    // Public-facing carousel — exclude paused, soft-deleted, and products
    // belonging to a deleted store.
    where: { isActive: true, deletedAt: null, store: { deletedAt: null } },
    orderBy: { reviews: { _count: "desc" } },
    take,
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

export async function getFeaturedStores(take = 4) {
  return prisma.store.findMany({
    where: { deletedAt: null },
    take,
    orderBy: { createdAt: "desc" },
    select: {
      storeId: true,
      name: true,
      profileImage: true,
      coverImage: true,
      description: true,
      createdAt: true,
      businessType: { select: { name: true } },
      _count: { select: { products: true } },
    },
  });
}

/** Public store page: store + owner + products grid + aggregate ratings. */
export async function getStore(storeId: number) {
  // Both queries depend only on storeId — run them in parallel to halve
  // round-trip latency to Neon.
  const [store, products] = await Promise.all([
    prisma.store.findFirst({
      // Soft-deleted stores are off-limits to the public store page.
      where: { storeId, deletedAt: null },
      include: {
        owner: { select: { firstName: true, lastName: true, profileImage: true, username: true, createdDate: true } },
        businessType: true,
        stats: true,
      },
    }),
    prisma.product.findMany({
      // Public store page only shows active, non-deleted products.
      where: { storeId, isActive: true, deletedAt: null },
      orderBy: { productId: "desc" },
      include: {
        items: { select: { price: true, discountPercent: true } },
        images: { select: { productImage: true }, orderBy: { sortOrder: "asc" }, take: 1 },
        productNTags: { include: { tag: { select: { tagName: true } } } },
        reviews: { select: { rating: true } },
      },
    }),
  ]);
  if (!store) return null;

  const items = products.map((p) => {
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
      storeName: store.name,
      storeId: store.storeId,
      avgRating: ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : undefined,
      reviewCount: ratings.length,
      discountPercent: maxDiscount || undefined,
      tags: p.productNTags.map((nt) => nt.tag.tagName),
    };
  });

  const allRatings = products.flatMap((p) => p.reviews.map((r) => r.rating));
  const avgRating = allRatings.length ? allRatings.reduce((a, b) => a + b, 0) / allRatings.length : undefined;

  return { store, products: items, productCount: products.length, reviewCount: allRatings.length, avgRating };
}

/**
 * Products the user purchased (paid/fulfilled orders) but has NOT reviewed
 * yet — drives the "Things to review" section on /my-reviews (buyer view).
 */
export async function getPendingReviewProducts(userId: number) {
  const orderItems = await prisma.orderItem.findMany({
    where: {
      order: {
        cart: { userId },
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

  const byId = new Map<number, (typeof orderItems)[number]["productItem"]["product"]>();
  for (const oi of orderItems) byId.set(oi.productItem.product.productId, oi.productItem.product);
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

// Reference data that ~never changes within a session. Cached for 1 hour so
// `/` and `/browse` stop hitting Neon on every render.
export const getCategories = unstable_cache(
  async () => prisma.category.findMany({ orderBy: { categoryName: "asc" } }),
  ["categories"],
  { revalidate: 3600, tags: ["categories"] },
);

export const getTags = unstable_cache(
  async () => prisma.productTag.findMany({ orderBy: { tagName: "asc" } }),
  ["tags"],
  { revalidate: 3600, tags: ["tags"] },
);

export const getBusinessTypes = unstable_cache(
  async () => prisma.businessType.findMany({ orderBy: { name: "asc" } }),
  ["business-types"],
  { revalidate: 3600, tags: ["business-types"] },
);

// Country list for the profile-edit / register dropdowns. Effectively static
// (countries don't change within a session, or a year). Cached to keep the
// /profile/edit cold path off Neon.
export const getCountries = unstable_cache(
  async () =>
    prisma.country.findMany({
      select: { countryId: true, name: true },
      orderBy: { name: "asc" },
    }),
  ["countries"],
  { revalidate: 3600, tags: ["countries"] },
);

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
  // 1..5 — keeps only products whose average review rating is at least this.
  // When set, we push the threshold into a HAVING clause via $queryRaw so
  // pagination totals stay correct (a JS post-filter would lie about
  // total/totalPages).
  minRating?: number;
}) {
  const sort = params.sort ?? "newest";
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 16;

  // Public browse — never surface paused, soft-deleted, or stores that
  // were soft-deleted (orphan products).
  const where: Prisma.ProductWhereInput = {
    isActive: true,
    deletedAt: null,
    store: { deletedAt: null },
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

  // Rating filter active: gather the qualifying productIds via a HAVING
  // raw query so total / totalPages reflect the *post-filter* universe.
  // We narrow the candidate set to products that already match the base
  // `where` (so the IN-list stays small) before aggregating reviews.
  const minRating = params.minRating && params.minRating > 0 ? params.minRating : null;
  let qualifyingIds: Set<number> | null = null;
  if (minRating !== null) {
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
    qualifyingIds = new Set(ratingRows.map((r) => Number(r.product_id)));
    if (qualifyingIds.size === 0) {
      return { items: [], page, pageSize, total: 0, totalPages: 1 };
    }
  }

  const effectiveWhere: Prisma.ProductWhereInput = qualifyingIds
    ? { ...where, productId: { in: [...qualifyingIds] } }
    : where;

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

export async function getProduct(id: number) {
  // Public product detail must hide soft-deleted products and products
  // whose store was soft-deleted (orphans).
  const product = await prisma.product.findFirst({
    where: { productId: id, deletedAt: null, store: { deletedAt: null } },
    include: {
      store: {
        select: {
          storeId: true,
          // Owner id powers the "Ask the seller" link on the product
          // page — Phase 10 Step 3c surfaces messaging from the
          // existing store-info card without an extra query.
          ownerId: true,
          name: true,
          profileImage: true,
          businessType: { select: { name: true } },
          stats: { select: { responseTime: true } },
        },
      },
      category: true,
      items: { orderBy: { price: "asc" } },
      images: { orderBy: { sortOrder: "asc" } },
      productNTags: { include: { tag: true } },
      reviews: {
        // Phase 11 / F1 — cascade the soft-delete on `User` into review
        // visibility on the public product page. Without this filter a
        // reviewer flagged + soft-deleted via `DELETE /api/admin/users`
        // still has their comment + display name visible to every
        // guest, defeating the moderation pipeline.
        where: { user: { deletedAt: null } },
        orderBy: { createdAt: "desc" },
        take: 5,
        include: {
          // userId is required by the moderation UI so we can show the
          // edit/delete buttons to the review's author (in addition to
          // any admin viewing the page).
          user: { select: { userId: true, firstName: true, lastName: true, profileImage: true, username: true } },
        },
      },
    },
  });
  if (!product) return null;
  const ratings = product.reviews.map((r) => r.rating);
  const avgRating = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : undefined;
  return { ...product, avgRating, reviewCount: ratings.length };
}

/**
 * "More like this" — same category, ideally sharing at least one tag,
 * excludes the source product. Returns up to `take` ProductCard rows
 * suitable for the existing <ProductCard /> component.
 */
export async function getRelatedProducts(productId: number, take = 4) {
  const source = await prisma.product.findUnique({
    where: { productId },
    select: {
      categoryId: true,
      productNTags: { select: { tagId: true } },
    },
  });
  if (!source) return [];
  const tagIds = source.productNTags.map((nt) => nt.tagId);

  const products = await prisma.product.findMany({
    where: {
      isActive: true,
      deletedAt: null,
      store: { deletedAt: null },
      productId: { not: productId },
      OR: [
        { categoryId: source.categoryId },
        ...(tagIds.length ? [{ productNTags: { some: { tagId: { in: tagIds } } } }] : []),
      ],
    },
    orderBy: { reviews: { _count: "desc" } },
    take,
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
 * Distinct buyers who paid for this product in the last `days` window.
 * Used by the social-proof line on /product/[id]: "X people bought this
 * in the last week". Returns 0 when nothing crosses the threshold so the
 * UI can simply hide the line.
 */
export async function getRecentPurchaseCount(productId: number, days = 7): Promise<number> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  // groupBy on order.cart.userId so multiple orders by the same buyer
  // count as one — feels more honest than raw line-item counts.
  const rows = await prisma.orderItem.findMany({
    where: {
      productItem: { productId },
      order: {
        status: { in: ["paid", "fulfilled"] },
        createdAt: { gte: since },
      },
    },
    select: { order: { select: { cart: { select: { userId: true } } } } },
  });
  return new Set(rows.map((r) => r.order.cart.userId)).size;
}

/**
 * Phase 11 / F13 — Admin store list. Mirrors the shape and predicates of
 * the `/api/admin/stores` route handler so server components can skip
 * the same-host HTTP round-trip that was costing /admin/stores ~2.5s of
 * skeleton-flash on cold load (see brief F13).
 *
 * Two reasons to bypass the proxied /api route from a server component:
 *
 *   1. **Latency.** A same-host HTTP hop (cookie forwarding + JSON
 *      encode/decode + a fresh fetch with `cache: "no-store"`) runs on
 *      every cold render. Skipping it is what made `/admin/users` and
 *      `/admin/audit` feel instant in Phase 10.
 *   2. **Environment parity.** The proxied path 404s on Vercel preview
 *      URLs with deployment protection (the same trap the queries.ts
 *      header warns about) — direct Prisma works the same on every
 *      environment.
 *
 * Predicates match `/api/admin/stores` after S1's CEO-Decision-2 fix:
 *   - `deletedAt: null` so the table + headline subtitle align with `/`,
 *     `/health`, `/admin` (all of which honour the soft-delete flag).
 *   - `_count.products` is restricted to non-deleted products so an
 *     admin never sees "12 products" on a store row while /browse shows
 *     11. The KPI tile sums those counts, so this also keeps the
 *     "Products listed" total in lock-step with `getStats().products`.
 */
export async function getAdminStores() {
  return prisma.store.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" },
    include: {
      owner: { select: { username: true, firstName: true, lastName: true, profileImage: true } },
      businessType: true,
      stats: true,
      _count: {
        select: {
          products: { where: { deletedAt: null } },
        },
      },
    },
  });
}
