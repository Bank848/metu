import { Router } from "express";
import { Prisma } from "@prisma/client";
import { browseQuerySchema } from "@metu/shared";
import { prisma } from "../lib/prisma.js";

export const productsRouter = Router();

// Shape products for listing cards (joins items/images/tags/store/stats).
async function listProducts(where: Prisma.ProductWhereInput, orderBy: Prisma.ProductOrderByWithRelationInput, take: number, skip: number) {
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

productsRouter.get("/", async (req, res, next) => {
  try {
    const parsed = browseQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "ValidationError", details: parsed.error.flatten() });
      return;
    }
    const { category, tags, minPrice, maxPrice, delivery, q, sort, page, pageSize } = parsed.data;

    const where: Prisma.ProductWhereInput = {};
    if (category) where.categoryId = category;
    if (q) {
      where.OR = [
        { name:        { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { store:       { name: { contains: q, mode: "insensitive" } } },
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
        case "price_asc": return { productId: "asc" }; // in-memory price sort below
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

    res.json({
      items,
      // Legacy shape for home: also expose items as top-level array when caller passes ?limit
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    });
  } catch (err) {
    next(err);
  }
});

// Home page helper — `/products?limit=8&sort=rating`
productsRouter.get("/featured", async (_req, res, next) => {
  try {
    const items = await listProducts({}, { reviews: { _count: "desc" } }, 8, 0);
    res.json(items);
  } catch (err) {
    next(err);
  }
});

productsRouter.get("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: "BadRequest" });
      return;
    }
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
    if (!product) {
      res.status(404).json({ error: "NotFound" });
      return;
    }
    const ratings = product.reviews.map((r) => r.rating);
    const avgRating = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : undefined;
    res.json({ ...product, avgRating, reviewCount: ratings.length });
  } catch (err) {
    next(err);
  }
});
