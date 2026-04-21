/**
 * Direct Prisma queries used by server components — bypasses HTTP round-trip
 * to /api routes (which fails on Vercel preview URLs that have deployment
 * protection, and is generally faster).
 */
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

const VALID_DELIVERY = ["download", "email", "license_key", "streaming"] as const;
type DeliveryMethod = (typeof VALID_DELIVERY)[number];

function safeDelivery(v: string | undefined): DeliveryMethod | undefined {
  return VALID_DELIVERY.includes(v as DeliveryMethod) ? (v as DeliveryMethod) : undefined;
}

export async function getStats() {
  const [sellers, products, orders, reviews] = await Promise.all([
    prisma.userStats.count({ where: { role: "seller" } }),
    prisma.product.count(),
    prisma.order.count(),
    prisma.productReview.count(),
  ]);
  return { sellers, products, orders, reviews };
}

export async function getFeaturedProducts(take = 8) {
  const products = await prisma.product.findMany({
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
    take,
    orderBy: { createdAt: "desc" },
    include: {
      businessType: true,
      stats: true,
      _count: { select: { products: true } },
    },
  });
}

/** Public store page: store + owner + products grid + aggregate ratings. */
export async function getStore(storeId: number) {
  const store = await prisma.store.findUnique({
    where: { storeId },
    include: {
      owner: { select: { firstName: true, lastName: true, profileImage: true, username: true, createdDate: true } },
      businessType: true,
      stats: true,
    },
  });
  if (!store) return null;

  const products = await prisma.product.findMany({
    where: { storeId },
    orderBy: { productId: "desc" },
    include: {
      items: { select: { price: true, discountPercent: true } },
      images: { select: { productImage: true }, orderBy: { sortOrder: "asc" }, take: 1 },
      productNTags: { include: { tag: { select: { tagName: true } } } },
      reviews: { select: { rating: true } },
    },
  });

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

export async function getCategories() {
  return prisma.category.findMany({ orderBy: { categoryName: "asc" } });
}

export async function getTags() {
  return prisma.productTag.findMany({ orderBy: { tagName: "asc" } });
}

export async function getBusinessTypes() {
  return prisma.businessType.findMany({ orderBy: { name: "asc" } });
}

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
}) {
  const sort = params.sort ?? "newest";
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 16;

  const where: Prisma.ProductWhereInput = {};
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

  const [rows, total] = await Promise.all([
    prisma.product.findMany({
      where,
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
    prisma.product.count({ where }),
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

  return { items, page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function getProduct(id: number) {
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
          user: { select: { firstName: true, lastName: true, profileImage: true, username: true } },
        },
      },
    },
  });
  if (!product) return null;
  const ratings = product.reviews.map((r) => r.rating);
  const avgRating = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : undefined;
  return { ...product, avgRating, reviewCount: ratings.length };
}
