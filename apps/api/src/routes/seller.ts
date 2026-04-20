import { Router } from "express";
import { Prisma } from "@prisma/client";
import {
  becomeSellerSchema,
  productInputSchema,
  couponInputSchema,
  updateOrderStatusSchema,
  updateStoreSchema,
} from "@metu/shared";
import { prisma } from "../lib/prisma.js";
import { currentAuth, requireAuth } from "../lib/auth.js";

export const sellerRouter = Router();

// Middleware: ensure the user owns a store; attach store to req.
async function withStore(req: any, res: any, next: any) {
  const auth = currentAuth(req)!;
  const store = await prisma.store.findUnique({ where: { ownerId: auth.uid } });
  if (!store) {
    res.status(403).json({ error: "NoStore", message: "Create a store first via /me/become-seller" });
    return;
  }
  req.store = store;
  next();
}

// Become a seller: creates store + updates user_stats.role to 'seller'.
sellerRouter.post("/become-seller", requireAuth(), async (req, res, next) => {
  try {
    const parsed = becomeSellerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "ValidationError", details: parsed.error.flatten() });
      return;
    }
    const auth = currentAuth(req)!;
    const existing = await prisma.store.findUnique({ where: { ownerId: auth.uid } });
    if (existing) {
      res.status(409).json({ error: "StoreExists", storeId: existing.storeId });
      return;
    }
    const store = await prisma.$transaction(async (tx) => {
      const store = await tx.store.create({
        data: {
          ownerId: auth.uid,
          businessTypeId: parsed.data.businessTypeId,
          name: parsed.data.name,
          description: parsed.data.description,
          profileImage: parsed.data.profileImage,
          coverImage: parsed.data.coverImage,
          stats: { create: {} },
        },
        include: { stats: true },
      });
      await tx.userStats.upsert({
        where: { userId: auth.uid },
        update: { role: "seller" },
        create: { userId: auth.uid, role: "seller" },
      });
      return store;
    });
    res.json(store);
  } catch (err) {
    next(err);
  }
});

sellerRouter.use(requireAuth());

// Seller stats overview
sellerRouter.get("/stats", withStore as any, async (req: any, res, next) => {
  try {
    const storeId: number = req.store.storeId;

    // KPIs via mixed Prisma + raw SQL to showcase DB skills.
    const [store, products, recentReviews, totals] = await Promise.all([
      prisma.store.findUnique({
        where: { storeId },
        include: { stats: true, businessType: true },
      }),
      prisma.product.count({ where: { storeId } }),
      prisma.productReview.findMany({
        where: { product: { storeId } },
        orderBy: { createdAt: "desc" },
        take: 5,
        include: {
          user: { select: { firstName: true, lastName: true, profileImage: true } },
          product: { select: { name: true, productId: true } },
        },
      }),
      prisma.$queryRaw<Array<{ paid_count: bigint; total_revenue: string | null; fulfilled_count: bigint; pending_count: bigint }>>`
        SELECT
          COUNT(DISTINCT CASE WHEN o.status IN ('paid','fulfilled') THEN o.order_id END)::bigint AS paid_count,
          COALESCE(SUM(CASE WHEN o.status IN ('paid','fulfilled') THEN oi.price_at_purchase * oi.quantity END), 0)::text AS total_revenue,
          COUNT(DISTINCT CASE WHEN o.status = 'fulfilled' THEN o.order_id END)::bigint AS fulfilled_count,
          COUNT(DISTINCT CASE WHEN o.status = 'pending' THEN o.order_id END)::bigint AS pending_count
        FROM order_item oi
        JOIN product_item pi ON pi.product_item_id = oi.product_item_id
        JOIN product p ON p.product_id = pi.product_id
        JOIN orders o ON o.order_id = oi.order_id
        WHERE p.store_id = ${storeId}
      `,
    ]);

    const dailyOrders = await prisma.$queryRaw<Array<{ day: Date; count: bigint }>>`
      SELECT DATE_TRUNC('day', o.created_at)::date AS day, COUNT(DISTINCT o.order_id)::bigint AS count
      FROM orders o
      JOIN order_item oi ON oi.order_id = o.order_id
      JOIN product_item pi ON pi.product_item_id = oi.product_item_id
      JOIN product p ON p.product_id = pi.product_id
      WHERE p.store_id = ${storeId}
        AND o.created_at >= NOW() - INTERVAL '30 days'
      GROUP BY day
      ORDER BY day
    `;

    const topProducts = await prisma.$queryRaw<Array<{ product_id: number; name: string; revenue: string; units: bigint }>>`
      SELECT p.product_id, p.name,
             COALESCE(SUM(oi.price_at_purchase * oi.quantity), 0)::text AS revenue,
             COALESCE(SUM(oi.quantity), 0)::bigint AS units
      FROM product p
      LEFT JOIN product_item pi ON pi.product_id = p.product_id
      LEFT JOIN order_item oi ON oi.product_item_id = pi.product_item_id
      WHERE p.store_id = ${storeId}
      GROUP BY p.product_id, p.name
      ORDER BY revenue DESC
      LIMIT 5
    `;

    res.json({
      store,
      productCount: products,
      kpi: {
        paidCount: Number(totals[0]?.paid_count ?? 0),
        totalRevenue: Number(totals[0]?.total_revenue ?? 0),
        fulfilledCount: Number(totals[0]?.fulfilled_count ?? 0),
        pendingCount: Number(totals[0]?.pending_count ?? 0),
      },
      dailyOrders: dailyOrders.map((r) => ({ day: r.day, count: Number(r.count) })),
      topProducts: topProducts.map((r) => ({ productId: r.product_id, name: r.name, revenue: Number(r.revenue), units: Number(r.units) })),
      recentReviews,
    });
  } catch (err) {
    next(err);
  }
});

sellerRouter.get("/products", withStore as any, async (req: any, res, next) => {
  try {
    const storeId: number = req.store.storeId;
    const rows = await prisma.product.findMany({
      where: { storeId },
      orderBy: { productId: "desc" },
      include: {
        category: true,
        items: { orderBy: { price: "asc" } },
        images: { take: 1, orderBy: { sortOrder: "asc" } },
        _count: { select: { reviews: true } },
      },
    });
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

sellerRouter.post("/products", withStore as any, async (req: any, res, next) => {
  try {
    const parsed = productInputSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "ValidationError", details: parsed.error.flatten() });
      return;
    }
    const storeId: number = req.store.storeId;
    const { name, description, categoryId, images, tagIds, items } = parsed.data;
    const product = await prisma.product.create({
      data: {
        storeId,
        categoryId,
        name,
        description,
        items: {
          create: items.map((it) => ({
            deliveryMethod: it.deliveryMethod,
            quantity: it.quantity,
            price: new Prisma.Decimal(it.price),
            discountPercent: it.discountPercent,
            discountAmount: new Prisma.Decimal(it.discountAmount),
          })),
        },
        images: {
          create: images.map((url, i) => ({ productImage: url, sortOrder: i })),
        },
        productNTags: {
          create: tagIds.map((tagId) => ({ tagId })),
        },
      },
    });
    res.json(product);
  } catch (err) {
    next(err);
  }
});

sellerRouter.patch("/products/:id", withStore as any, async (req: any, res, next) => {
  try {
    const id = Number(req.params.id);
    const storeId: number = req.store.storeId;
    const existing = await prisma.product.findFirst({ where: { productId: id, storeId } });
    if (!existing) {
      res.status(404).json({ error: "NotFound" });
      return;
    }
    const updated = await prisma.product.update({
      where: { productId: id },
      data: {
        name: req.body.name ?? existing.name,
        description: req.body.description ?? existing.description,
        categoryId: req.body.categoryId ?? existing.categoryId,
      },
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

sellerRouter.delete("/products/:id", withStore as any, async (req: any, res, next) => {
  try {
    const id = Number(req.params.id);
    const storeId: number = req.store.storeId;
    const existing = await prisma.product.findFirst({ where: { productId: id, storeId } });
    if (!existing) {
      res.status(404).json({ error: "NotFound" });
      return;
    }
    await prisma.product.delete({ where: { productId: id } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Coupons
sellerRouter.get("/coupons", withStore as any, async (req: any, res, next) => {
  try {
    const coupons = await prisma.coupon.findMany({
      where: { storeId: req.store.storeId },
      orderBy: { couponId: "desc" },
      include: { _count: { select: { usages: true } } },
    });
    res.json(coupons);
  } catch (err) {
    next(err);
  }
});

sellerRouter.post("/coupons", withStore as any, async (req: any, res, next) => {
  try {
    const parsed = couponInputSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "ValidationError", details: parsed.error.flatten() });
      return;
    }
    const created = await prisma.coupon.create({
      data: {
        storeId: req.store.storeId,
        code: parsed.data.code,
        discountType: parsed.data.discountType,
        discountValue: parsed.data.discountValue,
        startDate: new Date(parsed.data.startDate),
        endDate: new Date(parsed.data.endDate),
        usageLimit: parsed.data.usageLimit,
        isActive: parsed.data.isActive,
      },
    });
    res.json(created);
  } catch (err) {
    next(err);
  }
});

sellerRouter.patch("/coupons/:id/toggle", withStore as any, async (req: any, res, next) => {
  try {
    const id = Number(req.params.id);
    const coupon = await prisma.coupon.findFirst({ where: { couponId: id, storeId: req.store.storeId } });
    if (!coupon) {
      res.status(404).json({ error: "NotFound" });
      return;
    }
    const updated = await prisma.coupon.update({
      where: { couponId: id },
      data: { isActive: !coupon.isActive },
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// Orders inbox
sellerRouter.get("/orders", withStore as any, async (req: any, res, next) => {
  try {
    const status = (req.query.status as string | undefined) || undefined;
    const rows = await prisma.order.findMany({
      where: {
        ...(status ? { status: status as any } : {}),
        items: { some: { productItem: { product: { storeId: req.store.storeId } } } },
      },
      orderBy: { createdAt: "desc" },
      include: {
        cart: { include: { user: { select: { username: true, firstName: true, lastName: true, profileImage: true } } } },
        items: {
          where: { productItem: { product: { storeId: req.store.storeId } } },
          include: {
            productItem: {
              include: { product: { select: { name: true, productId: true, images: { take: 1, orderBy: { sortOrder: "asc" } } } } },
            },
          },
        },
        transaction: true,
      },
    });
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

sellerRouter.patch("/orders/:id/status", withStore as any, async (req: any, res, next) => {
  try {
    const parsed = updateOrderStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "ValidationError" });
      return;
    }
    const id = Number(req.params.id);
    // Only allow updating if the order contains a product from this store.
    const owns = await prisma.order.findFirst({
      where: { orderId: id, items: { some: { productItem: { product: { storeId: req.store.storeId } } } } },
    });
    if (!owns) {
      res.status(404).json({ error: "NotFound" });
      return;
    }
    const updated = await prisma.order.update({
      where: { orderId: id },
      data: { status: parsed.data.status },
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

sellerRouter.patch("/store", withStore as any, async (req: any, res, next) => {
  try {
    const parsed = updateStoreSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "ValidationError" });
      return;
    }
    const updated = await prisma.store.update({
      where: { storeId: req.store.storeId },
      data: parsed.data,
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});
