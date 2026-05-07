import { prisma } from "../db/prisma.js";
import type {
  ListStoreQuery,
  StoreDetailResponse,
  StoreListResponse,
} from "../models/stores.model.js";

// Public store DTO allowlist — Stripe IDs and seller contact PII
// must stay server-side. Buyers reach sellers via in-app channels.
const PUBLIC_STORE_FIELDS = {
  storeId: true,
  businessTypeId: true,
  name: true,
  description: true,
  profileImage: true,
  coverImage: true,
  createdAt: true,
  suspendedAt: true,
  rating: true,
} as const;

/**
 * Public store list — newest stores first, with their product count
 * + stats so the directory can show "X products · 4.6★" preview
 * lines without per-row Prisma round-trips. Soft-deleted stores
 * are hidden.
 */
export async function findStores(filters: ListStoreQuery): Promise<StoreListResponse> {
  return prisma.store.findMany({
    where: { suspendedAt: null },
    take: filters.limit,
    orderBy: { createdAt: "desc" },
    select: {
      ...PUBLIC_STORE_FIELDS,
      businessType: true,
      _count: { select: { products: true } },
    },
  });
}

/**
 * Storefront detail. Returns null for missing/deleted/suspended.
 * Envelope: { store, products, productCount, reviewCount, avgRating }.
 */
export async function findStoreById(
  storeId: number,
): Promise<StoreDetailResponse | null> {
  const [store, products] = await Promise.all([
    prisma.store.findFirst({
      // Suspended stores are hidden from public surfaces.
      where: { storeId, suspendedAt: null },
      // Same public allowlist as list. Owner exposes display fields only.
      select: {
        ...PUBLIC_STORE_FIELDS,
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
      },
    }),
    prisma.product.findMany({
      // Parent store already verified live above.
      where: { storeId, isActive: true },
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

  // Shape products inline; mirrors the products service shaper.
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
