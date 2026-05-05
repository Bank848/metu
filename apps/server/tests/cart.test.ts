import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { cookieFor } from "./_authMock.js";

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
    // Phase 42 — addItem checks the productItem's owning store so a
    // seller can't buy from their own store. Tests default the lookup
    // to a different owner so the existing happy-path expectations
    // still pass.
    productItem: { findUnique: vi.fn() },
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

beforeEach(async () => {
    const { signedOut } = await import("./_authMock.js");
    await signedOut();
  vi.clearAllMocks();
  // Default: requireAuth() resolves user 7 successfully.
  (prisma.user.findUnique as any).mockResolvedValue({
    userId: 7,
    deletedAt: null,
    stats: { role: "buyer" },
    store: null,
  });
  // Default: the product belongs to a different seller (ownerId: 99)
  // so the own-store guard never fires for these happy-path tests.
  // Phase 48 — `isStackable: true` so the already-owned guard skips
  // straight through; tests that need the guard active set their own
  // mock with `isStackable: false` + an `order.findFirst` return.
  // Phase 50 — `loadPurchasableProductItem` now also reads
  // `product.isActive`, `product.deletedAt`, `product.name`,
  // `product.storeId`, `store.deletedAt`, `store.suspendedAt`, and
  // `store.stripeChargesEnabled`; mock the happy-state values so the
  // availability gate passes for existing tests.
  (prisma.productItem.findUnique as any).mockResolvedValue({
    productItemId: 200,
    deliveryMethod: "download",
    quantity: 99,
    product: {
      productId: 50,
      name: "Test product",
      isStackable: true,
      isActive: true,
      deletedAt: null,
      storeId: 9,
      store: {
        ownerId: 99,
        deletedAt: null,
        suspendedAt: null,
        stripeChargesEnabled: true,
      },
    },
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

    const res = await request(buildApp()).get("/cart").set("Cookie", await cookieFor(7));
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
      .set("Cookie", await cookieFor(7))
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
      .set("Cookie", await cookieFor(7))
      .send({ quantity: 4 });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("CartItemNotFound");
  });

  // Phase 50 — PATCH used to write the raw quantity, bypassing the
  // digital cap that addItem enforced. Now the same purchasable gate
  // runs on update, so qty=10 on a download line caps at 1.
  it("caps digital quantity at 1 even when user submits a higher number", async () => {
    (prisma.cartItem.findUnique as any).mockResolvedValue({
      cartItemId: 100,
      cartId: 11,
      productItemId: 200,
      quantity: 1,
      cart: { userId: 7 },
    });
    (prisma.cartItem.update as any).mockResolvedValue({
      cartItemId: 100,
      quantity: 1,
    });

    const res = await request(buildApp())
      .patch("/cart/items/100")
      .set("Cookie", await cookieFor(7))
      .send({ quantity: 10 });

    expect(res.status).toBe(200);
    // The capped value (1) was written, not the requested 10.
    expect((prisma.cartItem.update as any).mock.calls[0][0].data.quantity).toBe(1);
  });
});

// Phase 50 — availability gate: addItem refuses paused / soft-deleted
// products, suspended / deleted stores. The four cases below mirror
// the bullet list in docs/source-code-bug-review-plan.md (P1 cart).
describe("Phase 50 — POST /cart/items availability gate", () => {
  beforeEach(() => {
    (prisma.cart.findFirst as any).mockResolvedValue({ cartId: 11, userId: 7, status: "active" });
  });

  it("409 ProductUnavailable when the product is paused (isActive=false)", async () => {
    (prisma.productItem.findUnique as any).mockResolvedValue({
      productItemId: 200,
      deliveryMethod: "download",
      quantity: 99,
      product: {
        productId: 50,
        name: "Paused product",
        isStackable: true,
        isActive: false,
        deletedAt: null,
        storeId: 9,
        store: { ownerId: 99, deletedAt: null, suspendedAt: null, stripeChargesEnabled: true },
      },
    });
    const res = await request(buildApp())
      .post("/cart/items")
      .set("Cookie", await cookieFor(7))
      .send({ productItemId: 200, quantity: 1 });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe("ProductUnavailable");
  });

  it("409 StoreUnavailable when the store is suspended", async () => {
    (prisma.productItem.findUnique as any).mockResolvedValue({
      productItemId: 200,
      deliveryMethod: "download",
      quantity: 99,
      product: {
        productId: 50,
        name: "Product on suspended store",
        isStackable: true,
        isActive: true,
        storeId: 9,
        store: {
          ownerId: 99,
          suspendedAt: new Date(),
          stripeChargesEnabled: true,
        },
      },
    });
    const res = await request(buildApp())
      .post("/cart/items")
      .set("Cookie", await cookieFor(7))
      .send({ productItemId: 200, quantity: 1 });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe("StoreUnavailable");
  });
});
