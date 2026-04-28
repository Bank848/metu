import { prisma } from "../db/prisma.js";
import type {
  ListStoreQuery,
  StoreDetailResponse,
  StoreListResponse,
} from "../models/stores.model.js";

/**
 * Public store list — newest stores first, with their product count
 * + stats so the directory can show "X products · 4.6★" preview
 * lines without per-row Prisma round-trips. Soft-deleted stores
 * are hidden.
 */
export async function findStores(filters: ListStoreQuery): Promise<StoreListResponse> {
  return prisma.store.findMany({
    where: { deletedAt: null, suspendedAt: null },
    take: filters.limit,
    orderBy: { createdAt: "desc" },
    include: {
      businessType: true,
      stats: true,
      _count: { select: { products: true } },
    },
  });
}

/**
 * Storefront detail — owner identity + the store's active product
 * grid + aggregate ratings. Returns the BFF-friendly envelope
 * `{ store, products, productCount, reviewCount, avgRating }`
 * (same shape `apps/web/lib/server/queries.ts:getStore` returned
 * before Phase 13.1, so server pages don't have to re-shape).
 *
 * Returns `null` when the store is unknown OR has been
 * soft-deleted, so the controller can decide between 404 and an
 * alternate behaviour.
 */
export async function findStoreById(
  storeId: number,
): Promise<StoreDetailResponse | null> {
  const [store, products] = await Promise.all([
    prisma.store.findFirst({
      // Phase 16.1 — also filter suspendedAt:null. A suspended store
      // is HIDDEN from public surfaces (vs the seller dashboard, which
      // sees it with a banner). Returning null here makes the
      // controller surface 404 — same shape as a deleted/missing store.
      where: { storeId, deletedAt: null, suspendedAt: null },
      include: {
        owner: {
          select: {
            firstName: true,
            lastName: true,
            profileImage: true,
            username: true,
            createdDate: true,
          },
        },
        businessType: true,
        stats: true,
      },
    }),
    prisma.product.findMany({
      // Phase 16.1 — by the time we reach this query the parent
      // store is already verified live (suspended store would have
      // returned null above), so no extra suspendedAt filter on the
      // product side is needed.
      where: { storeId, isActive: true, deletedAt: null },
      orderBy: { productId: "desc" },
      include: {
        items: { select: { price: true, discountPercent: true } },
        images: {
          select: { productImage: true },
          orderBy: { sortOrder: "asc" },
          take: 1,
        },
        productNTags: { include: { tag: { select: { tagName: true } } } },
        reviews: { select: { rating: true } },
      },
    }),
  ]);
  if (!store) return null;

  // Shape products into `ProductListItem` (mirrors the products
  // service shaper — duplicated here to avoid a cross-service import
  // for one helper). When we add a Reviews module in Phase 13.X,
  // both services can pull the shaper from a shared `lib/`.
  const items = products.map((p) => {
    const prices = p.items.map((i) => Number(i.price));
    const ratings = p.reviews.map((r) => r.rating);
    const maxDiscount = p.items.reduce(
      (m, it) => Math.max(m, it.discountPercent ?? 0),
      0,
    );
    return {
      productId: p.productId,
      name: p.name,
      description: p.description,
      image:
        p.images[0]?.productImage ??
        `https://picsum.photos/seed/p${p.productId}/800/600`,
      minPrice: prices.length ? Math.min(...prices) : 0,
      maxPrice: prices.length ? Math.max(...prices) : 0,
      storeName: store.name,
      storeId: store.storeId,
      avgRating: ratings.length
        ? ratings.reduce((a, b) => a + b, 0) / ratings.length
        : undefined,
      reviewCount: ratings.length,
      discountPercent: maxDiscount || undefined,
      tags: p.productNTags.map((nt) => nt.tag.tagName),
    };
  });

  const allRatings = products.flatMap((p) => p.reviews.map((r) => r.rating));
  const avgRating = allRatings.length
    ? allRatings.reduce((a, b) => a + b, 0) / allRatings.length
    : undefined;

  return {
    store,
    products: items,
    productCount: products.length,
    reviewCount: allRatings.length,
    avgRating,
  };
}
