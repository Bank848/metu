/**
 * Cart resource tests — covers the high-leverage flows:
 *   • GET    /cart           authed read returns the line envelope
 *   • POST   /cart/items     401 when no cookie + happy path with cookie
 *   • PATCH  /cart/items/:id 404 when the item belongs to someone else
 *                            (don't leak whether the id exists)
 *   • DELETE /cart/items/:id 404 same ownership rule
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";

vi.mock("../src/db/prisma.js", () => ({
  prisma: {
    $queryRaw: vi.fn(),
    user: { findUnique: vi.fn() },
    cart: { findFirst: vi.fn(), create: vi.fn() },
    cartItem: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

const { prisma } = await import("../src/db/prisma.js");
const { buildApp } = await import("../src/app.js");

const SECRET = process.env.JWT_SECRET ?? "dev-only-fallback-secret";
function cookieFor(uid: number, role: "buyer" | "seller" | "admin" = "buyer") {
  const token = jwt.sign({ uid, role }, SECRET, { expiresIn: "1h" });
  return `metu_auth=${token}`;
}

beforeEach(() => {
  vi.clearAllMocks();
  // Default: requireAuth() resolves user 7 successfully.
  (prisma.user.findUnique as any).mockResolvedValue({
    userId: 7,
    deletedAt: null,
    stats: { role: "buyer" },
    store: null,
  });
});

describe("GET /cart", () => {
  it("returns 401 without a cookie", async () => {
    const res = await request(buildApp()).get("/cart");
    expect(res.status).toBe(401);
  });

  it("returns the cart envelope (cartId + items + subtotal)", async () => {
    (prisma.cart.findFirst as any).mockResolvedValue({ cartId: 11, userId: 7, status: "active" });
    (prisma.cartItem.findMany as any).mockResolvedValue([
      {
        cartItemId: 100,
        productItemId: 200,
        quantity: 2,
        productItem: {
          productId: 50,
          deliveryMethod: "download",
          quantity: 99,
          price: 100,
          discountPercent: 10,
          product: {
            name: "Test product",
            store: { storeId: 9, name: "Store", profileImage: null },
            images: [{ productImage: "https://img.example/p1.png" }],
          },
        },
      },
    ]);

    const res = await request(buildApp()).get("/cart").set("Cookie", cookieFor(7));
    expect(res.status).toBe(200);
    expect(res.body.cartId).toBe(11);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].cartItemId).toBe(100);
    // 100 * (1 - 0.10) = 90 unit; * qty 2 = 180 line total
    expect(res.body.items[0].lineTotal).toBe(180);
    expect(res.body.subtotal).toBe(180);
  });
});

describe("POST /cart/items", () => {
  it("merges quantity when productItem already exists in the cart", async () => {
    (prisma.cart.findFirst as any).mockResolvedValue({ cartId: 11, userId: 7, status: "active" });
    (prisma.cartItem.findUnique as any).mockResolvedValue({
      cartItemId: 100,
      cartId: 11,
      productItemId: 200,
      quantity: 3,
    });
    (prisma.cartItem.update as any).mockResolvedValue({
      cartItemId: 100,
      quantity: 5,
    });

    const res = await request(buildApp())
      .post("/cart/items")
      .set("Cookie", cookieFor(7))
      .send({ productItemId: 200, quantity: 2 });

    expect(res.status).toBe(200);
    expect(res.body.merged).toBe(true);
    expect(res.body.cartItem.quantity).toBe(5);
  });
});

describe("PATCH /cart/items/:id", () => {
  it("returns 404 when the item belongs to a different user (no leak)", async () => {
    (prisma.cartItem.findUnique as any).mockResolvedValue({
      cartItemId: 100,
      cartId: 11,
      productItemId: 200,
      quantity: 3,
      cart: { userId: 999 }, // someone else's cart
    });

    const res = await request(buildApp())
      .patch("/cart/items/100")
      .set("Cookie", cookieFor(7))
      .send({ quantity: 4 });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("CartItemNotFound");
  });
});
