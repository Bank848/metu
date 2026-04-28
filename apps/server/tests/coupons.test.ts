import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";

vi.mock("../src/db/prisma.js", () => ({
  prisma: {
    $queryRaw: vi.fn(),
    user: { findUnique: vi.fn() },
    coupon: { findFirst: vi.fn() },
    couponUsage: { count: vi.fn() },
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

describe("POST /coupons/validate", () => {
  it("returns valid:false (200) when the code doesn't exist", async () => {
    (prisma.coupon.findFirst as any).mockResolvedValue(null);
    const res = await request(buildApp())
      .post("/coupons/validate")
      .set("Cookie", cookie)
      .send({ code: "NOPE" });
    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(false);
    expect(res.body.reason).toMatch(/not found/i);
  });

  it("returns valid:true with discount metadata for an active coupon", async () => {
    const now = new Date();
    (prisma.coupon.findFirst as any).mockResolvedValue({
      couponId: 1,
      code: "METU10",
      discountType: "percent",
      discountValue: 10,
      startDate: new Date(now.getTime() - 86400e3),
      endDate: new Date(now.getTime() + 86400e3),
      usageLimit: 100,
      store: { storeId: 9, name: "Kluay Studio" },
    });
    (prisma.couponUsage.count as any).mockResolvedValue(3);

    const res = await request(buildApp())
      .post("/coupons/validate")
      .set("Cookie", cookie)
      .send({ code: "METU10" });
    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(true);
    expect(res.body.discountValue).toBe(10);
    expect(res.body.store.name).toBe("Kluay Studio");
  });

  it("returns valid:false when usage limit hit", async () => {
    const now = new Date();
    (prisma.coupon.findFirst as any).mockResolvedValue({
      couponId: 1,
      code: "MAXED",
      discountType: "percent",
      discountValue: 10,
      startDate: new Date(now.getTime() - 86400e3),
      endDate: new Date(now.getTime() + 86400e3),
      usageLimit: 5,
      store: { storeId: 9, name: "Store" },
    });
    (prisma.couponUsage.count as any).mockResolvedValue(5);

    const res = await request(buildApp())
      .post("/coupons/validate")
      .set("Cookie", cookie)
      .send({ code: "MAXED" });
    expect(res.body.valid).toBe(false);
    expect(res.body.reason).toMatch(/limit reached/i);
  });
});
