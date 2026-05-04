import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { cookieFor } from "./_authMock.js";

vi.mock("../src/db/prisma.js", () => ({
  prisma: {
    $queryRaw: vi.fn(),
    $transaction: vi.fn(),
    user: { findUnique: vi.fn() },
    cart: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    cartItem: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
    },
    productItem: { findUnique: vi.fn() },
    order: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
    store: { findUnique: vi.fn(), count: vi.fn() },
    coupon: { findFirst: vi.fn() },
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

vi.mock("../src/services/settings.service.js", () => ({
  getSettings: vi.fn(async () => ({
    favoritesEnabled: true,
    platformFeePercent: 5,
    updatedAt: new Date(),
    googleEnabled: false,
  })),
}));

const { prisma } = await import("../src/db/prisma.js");
const { buildApp } = await import("../src/app.js");

beforeEach(async () => {
  const { signedOut } = await import("./_authMock.js");
  await signedOut();
  vi.clearAllMocks();
  (prisma.user.findUnique as any).mockResolvedValue({
    userId: 7,
    deletedAt: null,
    stats: { role: "buyer" },
    store: null,
  });
});

describe("POST /cart/items — already-owned guard (Phase 48)", () => {
  it("blocks re-adding a non-stackable product the user already paid for", async () => {
    // Product is non-stackable (e.g. download / streaming default).
    (prisma.productItem.findUnique as any).mockResolvedValue({
      productItemId: 200,
      deliveryMethod: "download",
      quantity: 1,
      product: {
        productId: 50,
        name: "One-shot eBook",
        isStackable: false,
        isActive: true,
        deletedAt: null,
        storeId: 99,
        store: { deletedAt: null, suspendedAt: null, stripeChargesEnabled: true },
      },
    });
    // The buyer already has a paid order containing this product.
    (prisma.order.findFirst as any).mockResolvedValue({ orderId: 17 });
    (prisma.cart.findFirst as any).mockResolvedValue({ cartId: 11 });

    const res = await request(buildApp())
      .post("/cart/items")
      .set("Cookie", await cookieFor(7))
      .send({ productItemId: 200, quantity: 1 });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe("AlreadyOwned");
    expect(res.body.orderId).toBe(17);
    expect(prisma.cartItem.create).not.toHaveBeenCalled();
  });

  it("allows re-adding when the product IS stackable (license keys)", async () => {
    (prisma.productItem.findUnique as any).mockResolvedValue({
      productItemId: 201,
      deliveryMethod: "license_key",
      quantity: 99,
      product: {
        productId: 51,
        name: "License key bulk pack",
        isStackable: true,
        isActive: true,
        deletedAt: null,
        storeId: 99,
        store: { deletedAt: null, suspendedAt: null, stripeChargesEnabled: true },
      },
    });
    // Even if we have a previous purchase, stackable = OK.
    (prisma.order.findFirst as any).mockResolvedValue({ orderId: 17 });
    (prisma.cart.findFirst as any).mockResolvedValue({ cartId: 11 });
    (prisma.cartItem.findUnique as any).mockResolvedValue(null);
    (prisma.cartItem.create as any).mockResolvedValue({
      cartItemId: 1,
      cartId: 11,
      productItemId: 201,
      quantity: 1,
    });

    const res = await request(buildApp())
      .post("/cart/items")
      .set("Cookie", await cookieFor(7))
      .send({ productItemId: 201, quantity: 1 });

    expect(res.status).not.toBe(409);
  });
});

describe("POST /orders — defence-in-depth checkout guards", () => {
  function mockSingleStorePendingCart(productOpts: {
    isStackable?: boolean;
    storeId?: number;
  } = {}) {
    const { isStackable = true, storeId = 99 } = productOpts;
    (prisma.cart.findFirst as any).mockResolvedValue({
      cartId: 1,
      items: [
        {
          cartItemId: 10,
          productItemId: 200,
          quantity: 1,
          productItem: {
            productItemId: 200,
            price: "100",
            discountPercent: 0,
            deliveryMethod: "download",
            quantity: 1,
            product: {
              productId: 50,
              isStackable,
              isActive: true,
              deletedAt: null,
              storeId,
              store: { deletedAt: null, suspendedAt: null, stripeChargesEnabled: true },
              name: "Item",
            },
          },
        },
      ],
    });
    // Stale-order sweep
    (prisma.order.updateMany as any).mockResolvedValue({ count: 0 });
    // loadPurchasableProductItem call
    (prisma.productItem.findUnique as any).mockResolvedValue({
      productItemId: 200,
      deliveryMethod: "download",
      quantity: 99,
      product: {
        productId: 50,
        isStackable,
        isActive: true,
        deletedAt: null,
        storeId,
        name: "Item",
        store: { deletedAt: null, suspendedAt: null, stripeChargesEnabled: true },
      },
    });
  }

  it("returns 409 AlreadyOwned when checkout includes a non-stackable already-owned product", async () => {
    mockSingleStorePendingCart({ isStackable: false });
    (prisma.order.findFirst as any).mockResolvedValue({
      orderId: 25,
      items: [{ productItem: { productId: 50 } }],
    });

    const res = await request(buildApp())
      .post("/orders")
      .set("Cookie", await cookieFor(7))
      .send({});

    expect(res.status).toBe(409);
    expect(res.body.error).toBe("AlreadyOwned");
    expect(res.body.orderId).toBe(25);
  });
});

describe("GET /seller/orders/export — CSV formula injection neutralised", () => {
  beforeEach(() => {
    (prisma.user.findUnique as any).mockResolvedValue({
      userId: 7,
      deletedAt: null,
      stats: { role: "seller" },
      store: { storeId: 99, deletedAt: null, suspendedAt: null },
    });
  });

  it("prefixes a buyer-controlled username starting with `=` with a single quote", async () => {
    (prisma.order.findMany as any).mockResolvedValue([
      {
        orderId: 1,
        createdAt: new Date("2026-01-01"),
        status: "paid",
        totalPrice: "100",
        cart: {
          user: {
            // Adversarial username — formulas in spreadsheets execute on open.
            username: "=cmd|'/c calc'!A0",
            email: "evil@example.com",
            firstName: "@evil",
            lastName: "+SUM(A1:A100)",
          },
        },
        items: [
          {
            quantity: 1,
            pricePerUnit: "100",
            productItem: {
              deliveryMethod: "download",
              product: { storeId: 99, name: "Pwn" },
            },
          },
        ],
      },
    ]);

    const res = await request(buildApp())
      .get("/seller/orders/export")
      .set("Cookie", await cookieFor(7, "seller"));

    expect(res.status).toBe(200);
    const body = res.text;
    // The critical assertion: no cell starts with =, +, -, @ — Excel
    // only treats these as formula-leading. Mid-cell occurrences (e.g.
    // `'+SUM(...)` after concatenation) are safe.
    const lines = body.trim().split("\n");
    // Skip header row.
    for (const row of lines.slice(1)) {
      const cells = row.split(",");
      for (const cell of cells) {
        // Strip surrounding quotes that escapeCsv adds for cells with
        // embedded `,`/`"`/newlines.
        const inner = cell.startsWith(`"`) && cell.endsWith(`"`)
          ? cell.slice(1, -1)
          : cell;
        expect(inner).not.toMatch(/^[=+\-@\t\r]/);
      }
    }
    // The originally dangerous values still appear, just neutralised
    // by the leading `'`.
    expect(body).toContain(`'=cmd|'/c calc'!A0`);
    expect(body).toContain(`'@evil`);
  });
});
