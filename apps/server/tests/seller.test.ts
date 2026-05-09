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
import { cookieFor } from "./_authMock.js";

vi.mock("../src/db/prisma.js", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    store: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    userStats: { findUnique: vi.fn(), upsert: vi.fn() },
    product: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    productItem: { findUnique: vi.fn(), update: vi.fn() },
    productReview: { findMany: vi.fn() },
    order: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    coupon: { findMany: vi.fn(), create: vi.fn() },
    transaction: { create: vi.fn() },
    auditLog: { create: vi.fn() },
    $queryRaw: vi.fn(),
    $transaction: vi.fn(),
  },
}));

vi.mock("../src/lib/auth.js", () => {
  const getSession = vi.fn(async () => null);
  const signInEmail = vi.fn(async () => {
    const headers = new Headers();
    headers.append("set-cookie", "better-auth.session_token=fake; Path=/; HttpOnly; SameSite=Lax");
    return new Response("", { status: 200, headers });
  });
  const signOut = vi.fn(async () => {
    const headers = new Headers();
    headers.append("set-cookie", "better-auth.session_token=; Path=/; Max-Age=0");
    return new Response("", { status: 200, headers });
  });
  const handler = vi.fn(async () => new Response("", { status: 404 }));
  return { auth: { api: { getSession, signInEmail, signOut }, handler } };
});

const { prisma } = await import("../src/db/prisma.js");
const { buildApp } = await import("../src/app.js");


const sellerUser = {
  userId: 7,
  stats: { role: "seller" },
  store: { storeId: 11, ownerId: 7, name: "My Shop" },
};
const buyerUser = {
  userId: 9,
  stats: { role: "buyer" },
  store: null,
};

beforeEach(async () => {
    const { signedOut } = await import("./_authMock.js");
    await signedOut();
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
      .set("Cookie", await cookieFor(9, "buyer"));
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
      .set("Cookie", await cookieFor(7));
    expect(res.status).toBe(200);
    expect(res.body.storeId).toBe(11);
    expect(prisma.store.findUnique).toHaveBeenCalledWith({
      where: { storeId: 11 },
      include: { businessType: true },
    });
  });
});

describe("GET /seller/products", () => {
  it("lists products scoped to the seller's store", async () => {
    (prisma.product.findMany as any).mockResolvedValue([
      { productId: 100, name: "thing" },
    ]);
    const res = await request(buildApp())
      .get("/seller/products")
      .set("Cookie", await cookieFor(7));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { storeId: 11 },
      }),
    );
  });
});

describe("GET /seller/products/:id", () => {
  it("404 when the product doesn't exist", async () => {
    (prisma.product.findUnique as any).mockResolvedValue(null);
    const res = await request(buildApp())
      .get("/seller/products/999")
      .set("Cookie", await cookieFor(7));
    expect(res.status).toBe(404);
  });

  it("403 when the product belongs to a different store", async () => {
    (prisma.product.findUnique as any).mockResolvedValue({
      productId: 100,
      storeId: 99, // different store
    });
    const res = await request(buildApp())
      .get("/seller/products/100")
      .set("Cookie", await cookieFor(7));
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
      .set("Cookie", await cookieFor(7));
    expect(res.status).toBe(200);
    expect(res.body.productId).toBe(100);
  });
});

describe("GET /seller/orders", () => {
  it("happy + status filter passes through to the where clause", async () => {
    (prisma.order.findMany as any).mockResolvedValue([{ orderId: 1 }]);
    const res = await request(buildApp())
      .get("/seller/orders?status=paid")
      .set("Cookie", await cookieFor(7));
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
        user: {
          username: "buyer1",
          email: "b@example.com",
          firstName: "Buy",
          lastName: "Er",
        },
        items: [
          {
            quantity: 2,
            pricePerUnit: "50.00",
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
      .set("Cookie", await cookieFor(7));
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
      .set("Cookie", await cookieFor(7));
    expect(res.status).toBe(200);
    expect(res.body.kpi.paidCount).toBe(4);
    expect(res.body.kpi.totalRevenue).toBe(500);
    expect(res.body.productCount).toBe(7);
    expect(res.body.topProducts[0].productId).toBe(100);
  });
});

// WRITE SIDE

describe("POST /seller/become-seller", () => {
  it("401 without cookie", async () => {
    const res = await request(buildApp())
      .post("/seller/become-seller")
      .send({});
    expect(res.status).toBe(401);
  });

  it("409 StoreExists when the user already owns one", async () => {
    // The 409 fires before the controller looks at the body — we need
    // to exercise the existing-store check, so the body just has to
    // pass schema validation. Schema rejects null for image URLs;
    // omit them entirely.
    (prisma.store.findUnique as any).mockResolvedValue({ storeId: 11 });
    const res = await request(buildApp())
      .post("/seller/become-seller")
      .set("Cookie", await cookieFor(7))
      .send({
        businessTypeId: 1,
        name: "Shop",
        description: "stuff",
      });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe("StoreExists");
  });

  it("400 ValidationError on bad body", async () => {
    (prisma.store.findUnique as any).mockResolvedValue(null);
    const res = await request(buildApp())
      .post("/seller/become-seller")
      .set("Cookie", await cookieFor(9, "buyer"))
      .send({}); // missing required fields
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("ValidationError");
  });
});

describe("PATCH /seller/store", () => {
  it("noop when body has no recognised keys", async () => {
    const res = await request(buildApp())
      .patch("/seller/store")
      .set("Cookie", await cookieFor(7))
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.noop).toBe(true);
    expect(prisma.store.update).not.toHaveBeenCalled();
  });

  it("partial update: only sent keys reach Prisma", async () => {
    (prisma.store.update as any).mockResolvedValue({
      storeId: 11,
      name: "New Name",
    });
    const res = await request(buildApp())
      .patch("/seller/store")
      .set("Cookie", await cookieFor(7))
      .send({ name: "New Name" });
    expect(res.status).toBe(200);
    expect(res.body.store.name).toBe("New Name");
    const call = (prisma.store.update as any).mock.calls[0][0];
    expect(call.data).toEqual({ name: "New Name" });
  });
});

describe("PATCH /seller/products/:id (pause toggle fast path)", () => {
  it("flips isActive without invoking the full edit transaction", async () => {
    (prisma.product.findUnique as any).mockResolvedValue({
      productId: 100,
      storeId: 11,
      name: "thing",
    });
    (prisma.product.update as any).mockResolvedValue({});
    const res = await request(buildApp())
      .patch("/seller/products/100")
      .set("Cookie", await cookieFor(7))
      .send({ isActive: false });
    expect(res.status).toBe(200);
    expect(res.body.isActive).toBe(false);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe("DELETE /seller/products/:id (hard-delete + audit)", () => {
  it("404 when product missing", async () => {
    (prisma.product.findUnique as any).mockResolvedValue(null);
    const res = await request(buildApp())
      .delete("/seller/products/9999")
      .set("Cookie", await cookieFor(7));
    expect(res.status).toBe(404);
  });

  it("403 when product belongs to another store", async () => {
    (prisma.product.findUnique as any).mockResolvedValue({
      productId: 100,
      storeId: 99,
    });
    const res = await request(buildApp())
      .delete("/seller/products/100")
      .set("Cookie", await cookieFor(7));
    expect(res.status).toBe(403);
  });

  it("happy: hard-delete + audit row written", async () => {
    (prisma.product.findUnique as any).mockResolvedValue({
      productId: 100,
      storeId: 11,
      name: "thing",
    });
    (prisma.product.delete as any).mockResolvedValue({});
    (prisma.auditLog.create as any).mockResolvedValue({});
    const res = await request(buildApp())
      .delete("/seller/products/100")
      .set("Cookie", await cookieFor(7));
    expect(res.status).toBe(200);
    expect(prisma.product.delete).toHaveBeenCalledWith({
      where: { productId: 100 },
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "product.delete",
        targetType: "product",
        targetId: 100,
      }),
    });
  });
});

describe("POST /seller/products/:id/duplicate", () => {
  it("404 when source missing", async () => {
    (prisma.product.findFirst as any).mockResolvedValue(null);
    const res = await request(buildApp())
      .post("/seller/products/9999/duplicate")
      .set("Cookie", await cookieFor(7));
    expect(res.status).toBe(404);
  });

  it("creates a paused copy prefixed 'Copy of '", async () => {
    (prisma.product.findFirst as any).mockResolvedValue({
      productId: 100,
      storeId: 11,
      categoryId: 5,
      name: "Original",
      description: "desc",
      items: [
        { deliveryMethod: "download", quantity: 10, price: 5, discountPercent: 0, discountAmount: 0 },
      ],
      images: [{ productImage: "data:img1", sortOrder: 0 }],
      productNTags: [{ tagId: 1 }],
    });
    (prisma.product.create as any).mockResolvedValue({ productId: 200 });
    const res = await request(buildApp())
      .post("/seller/products/100/duplicate")
      .set("Cookie", await cookieFor(7));
    expect(res.status).toBe(200);
    expect(res.body.productId).toBe(200);
    const create = (prisma.product.create as any).mock.calls[0][0];
    expect(create.data.name).toBe("Copy of Original");
    expect(create.data.isActive).toBe(false);
  });
});

describe("PATCH /seller/product-items/:id (variant nudge)", () => {
  it("403 when variant belongs to another store", async () => {
    (prisma.productItem.findUnique as any).mockResolvedValue({
      productItemId: 500,
      product: { storeId: 99 },
    });
    const res = await request(buildApp())
      .patch("/seller/product-items/500")
      .set("Cookie", await cookieFor(7))
      .send({ price: 99 });
    expect(res.status).toBe(403);
  });

  it("happy: updates only the keys sent", async () => {
    (prisma.productItem.findUnique as any).mockResolvedValue({
      productItemId: 500,
      product: { storeId: 11 },
    });
    (prisma.productItem.update as any).mockResolvedValue({
      productItemId: 500,
      price: 50,
      discountPercent: 10,
      quantity: 99,
    });
    const res = await request(buildApp())
      .patch("/seller/product-items/500")
      .set("Cookie", await cookieFor(7))
      .send({ quantity: 99 });
    expect(res.status).toBe(200);
    expect(res.body.productItem.quantity).toBe(99);
    const call = (prisma.productItem.update as any).mock.calls[0][0];
    expect(call.data).toEqual({ quantity: 99 });
  });
});

describe("POST /seller/coupons", () => {
  it("creates a coupon scoped to the seller's store", async () => {
    (prisma.coupon.create as any).mockResolvedValue({ couponId: 1 });
    const res = await request(buildApp())
      .post("/seller/coupons")
      .set("Cookie", await cookieFor(7))
      .send({
        code: "WELCOME10",
        discountType: "percent",
        discountValue: 10,
        startDate: "2026-01-01T00:00:00.000Z",
        endDate: "2026-12-31T23:59:59.000Z",
        usageLimit: 100,
        isActive: true,
      });
    expect(res.status).toBe(200);
    expect(res.body.couponId).toBe(1);
    const call = (prisma.coupon.create as any).mock.calls[0][0];
    expect(call.data.storeId).toBe(11);
    expect(call.data.code).toBe("WELCOME10");
  });
});

describe("PATCH /seller/orders/:id (status flip)", () => {
  it("409 AlreadyRefunded when order is refunded", async () => {
    (prisma.order.findUnique as any).mockResolvedValue({
      orderId: 1,
      status: "refunded",
      items: [{ productItem: { product: { storeId: 11 } } }],
    });
    const res = await request(buildApp())
      .patch("/seller/orders/1")
      .set("Cookie", await cookieFor(7))
      .send({ status: "fulfilled" });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe("AlreadyRefunded");
  });

  it("409 InvalidTransition when fulfilling a non-paid order", async () => {
    (prisma.order.findUnique as any).mockResolvedValue({
      orderId: 1,
      status: "pending",
      items: [{ productItem: { product: { storeId: 11 } } }],
    });
    const res = await request(buildApp())
      .patch("/seller/orders/1")
      .set("Cookie", await cookieFor(7))
      .send({ status: "fulfilled" });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe("InvalidTransition");
  });

  it("happy: paid → fulfilled, audit row written", async () => {
    (prisma.order.findUnique as any).mockResolvedValue({
      orderId: 1,
      status: "paid",
      items: [{ productItem: { product: { storeId: 11 } } }],
    });
    (prisma.order.update as any).mockResolvedValue({});
    (prisma.auditLog.create as any).mockResolvedValue({});
    const res = await request(buildApp())
      .patch("/seller/orders/1")
      .set("Cookie", await cookieFor(7))
      .send({ status: "fulfilled" });
    expect(res.status).toBe(200);
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "order.fulfilled" }),
    });
  });
});

describe("POST /seller/orders/:id/refund", () => {
  it("403 when order has no line from this store", async () => {
    (prisma.order.findUnique as any).mockResolvedValue({
      orderId: 1,
      status: "paid",
      userId: 9,
      items: [{ productItem: { product: { storeId: 99 } } }],
    });
    const res = await request(buildApp())
      .post("/seller/orders/1/refund")
      .set("Cookie", await cookieFor(7));
    expect(res.status).toBe(403);
  });

  it("happy: refunds + creates Transaction in one $transaction call", async () => {
    (prisma.order.findUnique as any).mockResolvedValue({
      orderId: 1,
      status: "paid",
      totalPrice: "100.00",
      userId: 9,
      items: [{ productItem: { product: { storeId: 11 } } }],
    });
    (prisma.$transaction as any).mockResolvedValue([{}, {}]);
    (prisma.auditLog.create as any).mockResolvedValue({});
    const res = await request(buildApp())
      .post("/seller/orders/1/refund")
      .set("Cookie", await cookieFor(7));
    expect(res.status).toBe(200);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "order.refund" }),
    });
  });
});
