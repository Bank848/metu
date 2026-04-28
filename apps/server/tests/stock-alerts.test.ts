/**
 * Stock alerts resource tests:
 *   • POST   /stock-alerts/:productItemId   401 / 404 / happy / re-arm clears notifiedAt
 *   • DELETE /stock-alerts/:productItemId   401 / silent no-op
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";

vi.mock("../src/db/prisma.js", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    productItem: { findFirst: vi.fn() },
    stockAlert: {
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

describe("POST /stock-alerts/:productItemId", () => {
  it("returns 401 without cookie", async () => {
    const res = await request(buildApp()).post("/stock-alerts/500");
    expect(res.status).toBe(401);
  });

  it("returns 404 for a soft-deleted / orphan variant", async () => {
    (prisma.productItem.findFirst as any).mockResolvedValue(null);
    const res = await request(buildApp())
      .post("/stock-alerts/9999")
      .set("Cookie", cookieFor(7));
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("VariantNotFound");
  });

  it("subscribes + re-arms (notifiedAt back to null on update)", async () => {
    (prisma.productItem.findFirst as any).mockResolvedValue({ productItemId: 500 });
    (prisma.stockAlert.upsert as any).mockResolvedValue({});
    const res = await request(buildApp())
      .post("/stock-alerts/500")
      .set("Cookie", cookieFor(7));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, subscribed: true });
    expect(prisma.stockAlert.upsert).toHaveBeenCalledWith({
      where: { userId_productItemId: { userId: 7, productItemId: 500 } },
      update: { notifiedAt: null },
      create: { userId: 7, productItemId: 500 },
    });
  });
});

describe("DELETE /stock-alerts/:productItemId", () => {
  it("returns 401 without cookie", async () => {
    const res = await request(buildApp()).delete("/stock-alerts/500");
    expect(res.status).toBe(401);
  });

  it("unsubscribes (silent no-op via deleteMany)", async () => {
    (prisma.stockAlert.deleteMany as any).mockResolvedValue({ count: 1 });
    const res = await request(buildApp())
      .delete("/stock-alerts/500")
      .set("Cookie", cookieFor(7));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, subscribed: false });
    expect(prisma.stockAlert.deleteMany).toHaveBeenCalledWith({
      where: { userId: 7, productItemId: 500 },
    });
  });
});
