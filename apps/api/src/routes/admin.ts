import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../lib/auth.js";

export const adminRouter = Router();

// Gate everything behind role=admin
adminRouter.use(requireAuth(["admin"]));

adminRouter.get("/stats", async (_req, res, next) => {
  try {
    const [users, stores, products, reviews, orders, gmv, pendingOrders] = await Promise.all([
      prisma.user.count(),
      prisma.store.count(),
      prisma.product.count(),
      prisma.productReview.count(),
      prisma.order.count(),
      prisma.$queryRaw<Array<{ total: string }>>`
        SELECT COALESCE(SUM(total_price), 0)::text AS total
        FROM orders
        WHERE status IN ('paid', 'fulfilled')
      `,
      prisma.order.count({ where: { status: "pending" } }),
    ]);
    const recentTx = await prisma.transaction.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        user: { select: { username: true, firstName: true, lastName: true, profileImage: true } },
      },
    });
    res.json({
      users, stores, products, reviews, orders,
      gmv: Number(gmv[0]?.total ?? 0),
      pendingOrders,
      recentTransactions: recentTx,
    });
  } catch (err) {
    next(err);
  }
});

adminRouter.get("/users", async (req, res, next) => {
  try {
    const q = (req.query.q as string) || "";
    const role = req.query.role as string | undefined;
    const page = Math.max(1, Number(req.query.page ?? 1));
    const pageSize = Math.min(60, Number(req.query.pageSize ?? 20));

    const where = {
      ...(q ? {
        OR: [
          { username: { contains: q, mode: "insensitive" as const } },
          { email: { contains: q, mode: "insensitive" as const } },
          { firstName: { contains: q, mode: "insensitive" as const } },
          { lastName: { contains: q, mode: "insensitive" as const } },
        ],
      } : {}),
      ...(role ? { stats: { role: role as any } } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdDate: "desc" },
        include: {
          country: true,
          stats: true,
          store: { select: { storeId: true, name: true } },
        },
      }),
      prisma.user.count({ where }),
    ]);

    res.json({
      items: items.map(({ password, ...u }) => u),
      page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)),
    });
  } catch (err) {
    next(err);
  }
});

adminRouter.patch("/users/:id/role", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const role = req.body.role as "buyer" | "seller" | "admin";
    if (!["buyer", "seller", "admin"].includes(role)) {
      res.status(400).json({ error: "InvalidRole" });
      return;
    }
    await prisma.userStats.upsert({
      where: { userId: id },
      update: { role },
      create: { userId: id, role },
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

adminRouter.get("/stores", async (_req, res, next) => {
  try {
    const stores = await prisma.store.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        owner: { select: { username: true, firstName: true, lastName: true, profileImage: true } },
        businessType: true,
        stats: true,
        _count: { select: { products: true } },
      },
    });
    res.json(stores);
  } catch (err) {
    next(err);
  }
});

// Reports — returns both the SQL and the result so the UI can show the query.
adminRouter.get("/reports/:name", async (req, res, next) => {
  try {
    const { name } = req.params;
    switch (name) {
      case "revenue-by-category": {
        const sql = `
-- Revenue by category: join orders → order_items → product_items → products → categories
-- and aggregate SUM(price_at_purchase * quantity) where the order is paid/fulfilled.
SELECT c.category_id, c.category_name,
       SUM(oi.price_at_purchase * oi.quantity)::text AS revenue,
       COUNT(DISTINCT o.order_id)::bigint AS orders
FROM orders o
JOIN order_item oi  ON oi.order_id = o.order_id
JOIN product_item pi ON pi.product_item_id = oi.product_item_id
JOIN product p       ON p.product_id = pi.product_id
JOIN category c      ON c.category_id = p.category_id
WHERE o.status IN ('paid','fulfilled')
GROUP BY c.category_id, c.category_name
ORDER BY revenue DESC`;
        const rows = await prisma.$queryRaw<Array<{ category_id: number; category_name: string; revenue: string; orders: bigint }>>`
          SELECT c.category_id, c.category_name,
                 SUM(oi.price_at_purchase * oi.quantity)::text AS revenue,
                 COUNT(DISTINCT o.order_id)::bigint AS orders
          FROM orders o
          JOIN order_item oi  ON oi.order_id = o.order_id
          JOIN product_item pi ON pi.product_item_id = oi.product_item_id
          JOIN product p       ON p.product_id = pi.product_id
          JOIN category c      ON c.category_id = p.category_id
          WHERE o.status IN ('paid','fulfilled')
          GROUP BY c.category_id, c.category_name
          ORDER BY revenue DESC
        `;
        res.json({ sql, rows: rows.map((r) => ({ ...r, orders: Number(r.orders), revenue: Number(r.revenue) })) });
        return;
      }
      case "top-stores": {
        const sql = `
-- Top stores by revenue: aggregate over products -> product_items -> order_items -> orders.
SELECT s.store_id, s.name,
       COALESCE(SUM(oi.price_at_purchase * oi.quantity), 0)::text AS revenue,
       COUNT(DISTINCT o.order_id)::bigint AS orders
FROM store s
LEFT JOIN product p       ON p.store_id = s.store_id
LEFT JOIN product_item pi ON pi.product_id = p.product_id
LEFT JOIN order_item oi   ON oi.product_item_id = pi.product_item_id
LEFT JOIN orders o        ON o.order_id = oi.order_id AND o.status IN ('paid','fulfilled')
GROUP BY s.store_id, s.name
ORDER BY revenue DESC
LIMIT 10`;
        const rows = await prisma.$queryRaw<Array<{ store_id: number; name: string; revenue: string; orders: bigint }>>`
          SELECT s.store_id, s.name,
                 COALESCE(SUM(oi.price_at_purchase * oi.quantity), 0)::text AS revenue,
                 COUNT(DISTINCT o.order_id)::bigint AS orders
          FROM store s
          LEFT JOIN product p       ON p.store_id = s.store_id
          LEFT JOIN product_item pi ON pi.product_id = p.product_id
          LEFT JOIN order_item oi   ON oi.product_item_id = pi.product_item_id
          LEFT JOIN orders o        ON o.order_id = oi.order_id AND o.status IN ('paid','fulfilled')
          GROUP BY s.store_id, s.name
          ORDER BY revenue DESC
          LIMIT 10
        `;
        res.json({ sql, rows: rows.map((r) => ({ ...r, orders: Number(r.orders), revenue: Number(r.revenue) })) });
        return;
      }
      case "orders-by-status": {
        const sql = `SELECT status, COUNT(*)::bigint AS count FROM orders GROUP BY status ORDER BY count DESC`;
        const rows = await prisma.$queryRaw<Array<{ status: string; count: bigint }>>`
          SELECT status::text, COUNT(*)::bigint AS count FROM orders GROUP BY status ORDER BY count DESC
        `;
        res.json({ sql, rows: rows.map((r) => ({ ...r, count: Number(r.count) })) });
        return;
      }
      case "signups-per-day": {
        const sql = `
SELECT DATE_TRUNC('day', created_date)::date AS day, COUNT(*)::bigint AS count
FROM "users"
WHERE created_date >= NOW() - INTERVAL '60 days'
GROUP BY day ORDER BY day`;
        const rows = await prisma.$queryRaw<Array<{ day: Date; count: bigint }>>`
          SELECT DATE_TRUNC('day', created_date)::date AS day, COUNT(*)::bigint AS count
          FROM "users"
          WHERE created_date >= NOW() - INTERVAL '60 days'
          GROUP BY day ORDER BY day
        `;
        res.json({ sql, rows: rows.map((r) => ({ ...r, count: Number(r.count) })) });
        return;
      }
      case "coupon-usage": {
        const sql = `
SELECT c.code, c.discount_type, c.discount_value,
       COUNT(cu.usage_id)::bigint AS times_used, c.usage_limit
FROM coupon c
LEFT JOIN coupon_usage cu ON cu.coupon_id = c.coupon_id
GROUP BY c.coupon_id, c.code, c.discount_type, c.discount_value, c.usage_limit
ORDER BY times_used DESC`;
        const rows = await prisma.$queryRaw<Array<{ code: string; discount_type: string; discount_value: number; times_used: bigint; usage_limit: number }>>`
          SELECT c.code, c.discount_type::text, c.discount_value,
                 COUNT(cu.usage_id)::bigint AS times_used, c.usage_limit
          FROM coupon c
          LEFT JOIN coupon_usage cu ON cu.coupon_id = c.coupon_id
          GROUP BY c.coupon_id, c.code, c.discount_type, c.discount_value, c.usage_limit
          ORDER BY times_used DESC
        `;
        res.json({ sql, rows: rows.map((r) => ({ ...r, times_used: Number(r.times_used) })) });
        return;
      }
      default:
        res.status(404).json({ error: "UnknownReport" });
    }
  } catch (err) {
    next(err);
  }
});

// Demo reset — keep it admin-only so the demo cannot be accidentally wiped.
adminRouter.post("/demo-reset", async (_req, res, next) => {
  try {
    // We can't easily run the seed script inline across workspaces, so we expose an error.
    // The README includes: `npm run db:reset` which is the supported flow.
    res.status(501).json({
      error: "NotImplemented",
      message: "Run `npm run db:reset` from the repo root to reseed. This endpoint is a placeholder.",
    });
  } catch (err) {
    next(err);
  }
});
