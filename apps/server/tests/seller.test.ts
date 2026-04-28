/**
 * Seller resource (read side) tests:
 *   • Every endpoint requires auth (401)
 *   • Every endpoint requires Store ownership (403 NoStore for users without one)
 *   • GET /seller/store           happy
 *   • GET /seller/products        happy
 *   • GET /seller/products/:id    404 / 403 / happy
 *   • GET /seller/orders          happy + status filter passes through
 *   • GET /seller/orders/export   CSV body + correct headers
 *   • GET /seller/stats           composite payload
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";

vi.mock("../src/db/prisma.js", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    store: { findUnique: vi.fn() },
    product: { findMany: vi.fn(), findUnique: vi.fn(), count: vi.fn() },
    productReview: { findMany: vi.fn() },
    order: { findMany: vi.fn() },
    $queryRaw: vi.fn(),
  },
}));

const { prisma } = await import("../src/db/prisma.js");
const { buildApp } = await import("../src/app.js");

const SECRET = process.env.JWT_SECRET ?? "dev-only-fallback-secret";
function cookieFor(uid: number, role: "buyer" | "seller" | "admin" = "seller") {
  return `metu_auth=${jwt.sign({ uid, role }, SECRET, { expiresIn: "1h" })}`;
}

const sellerUser = {
  userId: 7,
  deletedAt: null,
  stats: { role: "seller" },
  store: { storeId: 11, ownerId: 7, name: "My Shop" },
};
const buyerUser = {
  userId: 9,
  deletedAt: null,
  stats: { role: "buyer" },
  store: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  (prisma.user.findUnique as any).mockImplementation(({ where }: any) => {
    if (where.userId === 7) return Promise.resolve(sellerUser);
    if (where.userId === 9) return Promise.resolve(buyerUser);
    return Promise.resolve(null);
  });
});

describe("auth + store gates", () => {
  it("401 without cookie on every endpoint", async () => {
    const app = buildApp();
    for (const url of [
      "/seller/store",
      "/seller/products",
      "/seller/products/1",
      "/seller/stats",
      "/seller/orders",
      "/seller/orders/export",
    ]) {
      const res = await request(app).get(url);
      expect(res.status).toBe(401);
    }
  });

  it("403 NoStore for a buyer without a Store row", async () => {
    const res = await request(buildApp())
      .get("/seller/store")
      .set("Cookie", cookieFor(9, "buyer"));
    expect(res.status).toBe(403);
    expect(res.body.error).toBe("NoStore");
  });
});

describe("GET /seller/store", () => {
  it("returns the store with bizType + stats", async () => {
    (prisma.store.findUnique as any).mockResolvedValue({
      storeId: 11,
      name: "My Shop",
      businessType: { typeId: 1, name: "Solo" },
      stats: { rating: 48 },
    });
    const res = await request(buildApp())
      .get("/seller/store")
      .set("Cookie", cookieFor(7));
    expect(res.status).toBe(200);
    expect(res.body.storeId).toBe(11);
    expect(prisma.store.findUnique).toHaveBeenCalledWith({
      where: { storeId: 11 },
      include: { businessType: true, stats: true },
    });
  });
});

describe("GET /seller/products", () => {
  it("lists live products only (deletedAt:null)", async () => {
    (prisma.product.findMany as any).mockResolvedValue([
      { productId: 100, name: "thing" },
    ]);
    const res = await request(buildApp())
      .get("/seller/products")
      .set("Cookie", cookieFor(7));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { storeId: 11, deletedAt: null },
      }),
    );
  });
});

describe("GET /seller/products/:id", () => {
  it("404 when the product doesn't exist", async () => {
    (prisma.product.findUnique as any).mockResolvedValue(null);
    const res = await request(buildApp())
      .get("/seller/products/999")
      .set("Cookie", cookieFor(7));
    expect(res.status).toBe(404);
  });

  it("403 when the product belongs to a different store", async () => {
    (prisma.product.findUnique as any).mockResolvedValue({
      productId: 100,
      storeId: 99, // different store
    });
    const res = await request(buildApp())
      .get("/seller/products/100")
      .set("Cookie", cookieFor(7));
    expect(res.status).toBe(403);
  });

  it("happy: returns the product with full edit-form data", async () => {
    (prisma.product.findUnique as any).mockResolvedValue({
      productId: 100,
      storeId: 11,
      name: "thing",
      items: [],
      images: [],
      productNTags: [],
      category: { categoryId: 1 },
    });
    const res = await request(buildApp())
      .get("/seller/products/100")
      .set("Cookie", cookieFor(7));
    expect(res.status).toBe(200);
    expect(res.body.productId).toBe(100);
  });
});

describe("GET /seller/orders", () => {
  it("happy + status filter passes through to the where clause", async () => {
    (prisma.order.findMany as any).mockResolvedValue([{ orderId: 1 }]);
    const res = await request(buildApp())
      .get("/seller/orders?status=paid")
      .set("Cookie", cookieFor(7));
    expect(res.status).toBe(200);
    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "paid" }),
      }),
    );
  });
});

describe("GET /seller/orders/export", () => {
  it("returns CSV with header row + correct headers", async () => {
    (prisma.order.findMany as any).mockResolvedValue([
      {
        orderId: 1,
        createdAt: new Date("2026-04-28T10:00:00Z"),
        status: "paid",
        totalPrice: "100.00",
        cart: {
          user: {
            username: "buyer1",
            email: "b@example.com",
            firstName: "Buy",
            lastName: "Er",
          },
        },
        items: [
          {
            quantity: 2,
            priceAtPurchase: "50.00",
            productItem: {
              deliveryMethod: "download",
              product: { storeId: 11, name: "Widget" },
            },
          },
        ],
      },
    ]);
    const res = await request(buildApp())
      .get("/seller/orders/export")
      .set("Cookie", cookieFor(7));
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/csv");
    expect(res.headers["content-disposition"]).toContain("attachment");
    expect(res.text.split("\n")[0]).toContain("order_id,order_date");
    // Body row reflects our seeded order line.
    expect(res.text).toContain("Widget");
    expect(res.text).toContain("buyer1");
  });
});

describe("GET /seller/stats", () => {
  it("composes the analytics payload", async () => {
    (prisma.store.findUnique as any).mockResolvedValue({ storeId: 11 });
    (prisma.product.count as any).mockResolvedValue(7);
    (prisma.productReview.findMany as any).mockResolvedValue([]);
    // Three $queryRaw calls land in order: kpi totals → dailyOrders → topProducts.
    (prisma.$queryRaw as any)
      .mockResolvedValueOnce([
        {
          paid_count: 4n,
          total_revenue: "500.00",
          fulfilled_count: 2n,
          pending_count: 1n,
        },
      ])
      .mockResolvedValueOnce([{ day: new Date("2026-04-28"), count: 3n }])
      .mockResolvedValueOnce([
        { product_id: 100, name: "x", revenue: "200.00", units: 4n },
      ]);

    const res = await request(buildApp())
      .get("/seller/stats")
      .set("Cookie", cookieFor(7));
    expect(res.status).toBe(200);
    expect(res.body.kpi.paidCount).toBe(4);
    expect(res.body.kpi.totalRevenue).toBe(500);
    expect(res.body.productCount).toBe(7);
    expect(res.body.topProducts[0].productId).toBe(100);
  });
});
