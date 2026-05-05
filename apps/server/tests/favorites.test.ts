import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { cookieFor } from "./_authMock.js";

vi.mock("../src/db/prisma.js", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    product: { findFirst: vi.fn() },
    productFavorite: {
      findMany: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
    // Phase 17.x — favorites service now reads system_setting to gate
    // writes behind the favoritesEnabled flag. Default the mock to
    // flag=true so the existing happy-path assertions still pass.
    systemSetting: {
      findUnique: vi.fn().mockResolvedValue({
        id: 1,
        favoritesEnabled: true,
        platformFeePercent: 5,
        updatedAt: new Date(),
      }),
      create: vi.fn(),
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
  (prisma.user.findUnique as any).mockResolvedValue({
    userId: 7,
    stats: { role: "buyer" },
    store: null,
  });
});

describe("GET /favorites", () => {
  it("returns 401 without cookie", async () => {
    const res = await request(buildApp()).get("/favorites");
    expect(res.status).toBe(401);
  });

  it("returns the productIds for the current user", async () => {
    (prisma.productFavorite.findMany as any).mockResolvedValue([
      { productId: 100 },
      { productId: 200 },
    ]);
    const res = await request(buildApp())
      .get("/favorites")
      .set("Cookie", await cookieFor(7));
    expect(res.status).toBe(200);
    expect(res.body.productIds).toEqual([100, 200]);
  });
});

describe("POST /favorites/:productId", () => {
  it("returns 401 without cookie", async () => {
    const res = await request(buildApp()).post("/favorites/100");
    expect(res.status).toBe(401);
  });

  it("returns 404 for a soft-deleted / orphan product", async () => {
    (prisma.product.findFirst as any).mockResolvedValue(null);
    const res = await request(buildApp())
      .post("/favorites/9999")
      .set("Cookie", await cookieFor(7));
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("ProductNotFound");
  });

  it("hearts the product (idempotent via upsert)", async () => {
    (prisma.product.findFirst as any).mockResolvedValue({ productId: 100 });
    (prisma.productFavorite.upsert as any).mockResolvedValue({});
    const res = await request(buildApp())
      .post("/favorites/100")
      .set("Cookie", await cookieFor(7));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, favorited: true });
    expect(prisma.productFavorite.upsert).toHaveBeenCalledWith({
      where: { userId_productId: { userId: 7, productId: 100 } },
      update: {},
      create: { userId: 7, productId: 100 },
    });
  });
});

describe("DELETE /favorites/:productId", () => {
  it("returns 401 without cookie", async () => {
    const res = await request(buildApp()).delete("/favorites/100");
    expect(res.status).toBe(401);
  });

  it("removes the favourite (silent no-op via deleteMany)", async () => {
    (prisma.productFavorite.deleteMany as any).mockResolvedValue({ count: 1 });
    const res = await request(buildApp())
      .delete("/favorites/100")
      .set("Cookie", await cookieFor(7));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, favorited: false });
    expect(prisma.productFavorite.deleteMany).toHaveBeenCalledWith({
      where: { userId: 7, productId: 100 },
    });
  });
});
