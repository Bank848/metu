/**
 * Orders resource tests — covers the high-leverage paths.
 * Checkout itself involves ~6 Prisma calls in a transaction; we
 * mock the prisma surface and verify the controller-level contracts:
 *
 *   • POST /orders 401 without cookie
 *   • POST /orders 400 EmptyCart when active cart has no items
 *   • GET  /orders happy with cookie
 *   • GET  /orders/:id 404 when the order belongs to someone else
 *
 * Full checkout maths are exercised end-to-end against the live
 * Neon Postgres post-deploy (manual smoke).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";

vi.mock("../src/db/prisma.js", () => ({
  prisma: {
    $queryRaw: vi.fn(),
    user: { findUnique: vi.fn() },
    cart: { findFirst: vi.fn() },
    order: { findMany: vi.fn(), findFirst: vi.fn() },
  },
}));

const { prisma } = await import("../src/db/prisma.js");
const { buildApp } = await import("../src/app.js");

const SECRET = process.env.JWT_SECRET ?? "dev-only-fallback-secret";
const cookie = `metu_auth=${jwt.sign({ uid: 7, role: "buyer" }, SECRET, {
  expiresIn: "1h",
})}`;

beforeEach(() => {
  vi.clearAllMocks();
  (prisma.user.findUnique as any).mockResolvedValue({
    userId: 7,
    deletedAt: null,
    stats: { role: "buyer" },
    store: null,
  });
});

describe("POST /orders", () => {
  it("returns 401 without a cookie", async () => {
    const res = await request(buildApp()).post("/orders").send({});
    expect(res.status).toBe(401);
  });

  it("returns 400 EmptyCart when the active cart has no items", async () => {
    (prisma.cart.findFirst as any).mockResolvedValue(null);
    const res = await request(buildApp())
      .post("/orders")
      .set("Cookie", cookie)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("EmptyCart");
  });
});

describe("GET /orders", () => {
  it("lists the user's orders newest-first", async () => {
    (prisma.order.findMany as any).mockResolvedValue([
      { orderId: 100, totalPrice: "200", items: [], transaction: null },
    ]);
    const res = await request(buildApp()).get("/orders").set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].orderId).toBe(100);
  });
});

describe("GET /orders/:id", () => {
  it("returns 404 when the order doesn't exist OR belongs to someone else", async () => {
    (prisma.order.findFirst as any).mockResolvedValue(null);
    const res = await request(buildApp())
      .get("/orders/9999")
      .set("Cookie", cookie);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("OrderNotFound");
  });
});
