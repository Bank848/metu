import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { cookieFor } from "./_authMock.js";

vi.mock("../src/db/prisma.js", () => ({
  prisma: {
    $queryRaw: vi.fn(),
    user: { findUnique: vi.fn() },
    coupon: { findFirst: vi.fn() },
    couponUsage: { count: vi.fn() },
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

// Phase 16.3 — Mode A: cookie value irrelevant since better-auth's
// getSession is mocked. We still set Cookie on requests so middleware
// IP/UA capture has something realistic.
const cookie = "better-auth.session_token=fake-test-cookie";

beforeEach(async () => {
  const { signedInAs } = await import("./_authMock.js");
  vi.clearAllMocks();
  // Every coupon test runs as user 7 (the cookie constant above is
  // ceremonial — getSession is mocked).
  await signedInAs(7);
  (prisma.user.findUnique as any).mockResolvedValue({
    userId: 7,
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
    // PENTEST-002/109: rejection messages collapsed to a single generic
    // string so attackers can't enumerate which codes exist.
    expect(res.body.reason).toMatch(/not valid/i);
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
    // PENTEST-002/109: rejection messages collapsed to a single generic
    // string so attackers can't enumerate which codes exist or their
    // lifecycle state.
    expect(res.body.reason).toMatch(/not valid/i);
  });
});
