import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { cookieFor } from "./_authMock.js";

vi.mock("../src/db/prisma.js", () => ({
  prisma: {
    $queryRaw: vi.fn(async () => [{ now: new Date() }]),
    product: {
      findMany: vi.fn(),
      count: vi.fn(),
      findUnique: vi.fn(),
    },
    // Phase 43 — findProducts now probes store.count to decide whether
    // to enforce stripeChargesEnabled. Default to "0 stores ready" so
    // the legacy test data passes through unchanged.
    store: {
      count: vi.fn(async () => 0),
    },
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
});

describe("GET /products", () => {
  it("returns an items + total + pagination envelope", async () => {
    (prisma.product.findMany as any).mockResolvedValue([
      {
        productId: 1,
        name: "Test product",
        description: "...",
        store: { storeId: 9, name: "Test store" },
        items: [{ price: 100, discountPercent: 0 }],
        images: [],
        productNTags: [],
        reviews: [],
      },
    ]);
    (prisma.product.count as any).mockResolvedValue(1);

    const res = await request(buildApp()).get("/products");
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].productId).toBe(1);
    expect(res.body.total).toBe(1);
    expect(res.body.page).toBe(1);
    expect(res.body.totalPages).toBe(1);
  });
});

describe("GET /products/:id", () => {
  it("returns 404 when the product is missing", async () => {
    (prisma.product.findUnique as any).mockResolvedValue(null);
    const res = await request(buildApp()).get("/products/9999");
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("ProductNotFound");
  });

  it("returns 400 on a non-numeric id", async () => {
    const res = await request(buildApp()).get("/products/abc");
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("BadId");
  });
});
