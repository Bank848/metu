/**
 * Favorites resource tests — covers the high-leverage paths:
 *   • GET    /favorites                  401 without cookie / happy list
 *   • POST   /favorites/:productId       401 / 404 (orphan/soft-deleted) / happy add
 *   • DELETE /favorites/:productId       401 / silent no-op when absent
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";

vi.mock("../src/db/prisma.js", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    product: { findFirst: vi.fn() },
    productFavorite: {
      findMany: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

const { prisma } = await import("../src/db/prisma.js");
const { buildApp } = await import("../src/app.js");

const SECRET = process.env.JWT_SECRET ?? "dev-only-fallback-secret";
function cookieFor(uid: number, role: "buyer" | "seller" | "admin" = "buyer") {
  return `metu_auth=${jwt.sign({ uid, role }, SECRET, { expiresIn: "1h" })}`;
}

beforeEach(() => {
  vi.clearAllMocks();
  (prisma.user.findUnique as any).mockResolvedValue({
    userId: 7,
    deletedAt: null,
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
      .set("Cookie", cookieFor(7));
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
      .set("Cookie", cookieFor(7));
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("ProductNotFound");
  });

  it("hearts the product (idempotent via upsert)", async () => {
    (prisma.product.findFirst as any).mockResolvedValue({ productId: 100 });
    (prisma.productFavorite.upsert as any).mockResolvedValue({});
    const res = await request(buildApp())
      .post("/favorites/100")
      .set("Cookie", cookieFor(7));
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
      .set("Cookie", cookieFor(7));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, favorited: false });
    expect(prisma.productFavorite.deleteMany).toHaveBeenCalledWith({
      where: { userId: 7, productId: 100 },
    });
  });
});
