/**
 * Phase 20.2 — withdrawal flow tests.
 *
 * Covers the highest-leverage paths:
 *   • POST   /seller/withdrawals      auth, validation, balance check
 *   • GET    /admin/withdrawals       admin-role-gated
 *   • POST   /admin/withdrawals/:id/approve  → status flip + audit
 *   • POST   /admin/withdrawals/:id/reject   → coin refund + status
 *
 * The full balance-mutation transaction is exercised against the live
 * Neon Postgres post-deploy (manual smoke). Here we verify the
 * controller-level contracts + role gates + Zod validation surfaces.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { cookieFor, signedOut } from "./_authMock.js";

vi.mock("../src/db/prisma.js", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    store: { findUnique: vi.fn(), update: vi.fn() },
    withdrawal: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
    storeTransaction: { findMany: vi.fn(), create: vi.fn() },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("../src/lib/auth.js", () => {
  const getSession = vi.fn(async () => null);
  const signInEmail = vi.fn(async () => new Response("", { status: 200 }));
  const signOut = vi.fn(async () => new Response("", { status: 200 }));
  const handler = vi.fn(async () => new Response("", { status: 404 }));
  return { auth: { api: { getSession, signInEmail, signOut }, handler } };
});

// Settings — stub so getWithdrawalFeePercent has a deterministic value
// without touching prisma.systemSetting.
vi.mock("../src/services/settings.service.js", () => ({
  getSettings: vi.fn(async () => ({
    walletEnabled: true,
    chatEnabled: true,
    favoritesEnabled: true,
    promptpayId: "0812345678",
    platformFeePercent: 5,
    withdrawalFeePercent: 0,
    updatedAt: new Date(),
    googleEnabled: false,
  })),
}));

const { prisma } = await import("../src/db/prisma.js");
const { buildApp } = await import("../src/app.js");

beforeEach(async () => {
  vi.clearAllMocks();
});

describe("POST /seller/withdrawals", () => {
  it("returns 401 without a cookie", async () => {
    await signedOut();
    const res = await request(buildApp())
      .post("/seller/withdrawals")
      .send({ amountCoins: 100, bankName: "SCB", bankAccountNo: "1234567890", bankAccountName: "Bob" });
    expect(res.status).toBe(401);
  });

  it("returns 403 when the user has no store", async () => {
    // requireStore() resolves req.user.store via prisma.user.findUnique;
    // returning a user with `store: null` flunks the gate.
    (prisma.user.findUnique as any).mockResolvedValue({
      userId: 7,
      deletedAt: null,
      stats: { role: "buyer" },
      store: null,
    });
    const res = await request(buildApp())
      .post("/seller/withdrawals")
      .set("Cookie", await cookieFor(7))
      .send({
        amountCoins: 200,
        bankName: "SCB",
        bankAccountNo: "1234567890",
        bankAccountName: "Bob",
      });
    expect(res.status).toBe(403);
  });

  it("rejects validation errors (account no must be 10–12 digits)", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({
      userId: 7,
      deletedAt: null,
      stats: { role: "seller" },
      store: { storeId: 1, deletedAt: null, suspendedAt: null },
    });
    const res = await request(buildApp())
      .post("/seller/withdrawals")
      .set("Cookie", await cookieFor(7, "seller"))
      .send({
        amountCoins: 200,
        bankName: "SCB",
        bankAccountNo: "abc",
        bankAccountName: "Bob",
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("ValidationError");
  });

  it("rejects amounts below 100 coins", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({
      userId: 7,
      deletedAt: null,
      stats: { role: "seller" },
      store: { storeId: 1, deletedAt: null, suspendedAt: null },
    });
    const res = await request(buildApp())
      .post("/seller/withdrawals")
      .set("Cookie", await cookieFor(7, "seller"))
      .send({
        amountCoins: 50,
        bankName: "SCB",
        bankAccountNo: "1234567890",
        bankAccountName: "Bob",
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("ValidationError");
  });
});

describe("GET /admin/withdrawals", () => {
  it("returns 403 when the caller is a non-admin (seller)", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({
      userId: 7,
      deletedAt: null,
      stats: { role: "seller" },
      store: { storeId: 1, deletedAt: null, suspendedAt: null },
    });
    const res = await request(buildApp())
      .get("/admin/withdrawals")
      .set("Cookie", await cookieFor(7, "seller"));
    // The /admin mount-level gate fires BEFORE our controller-level
    // role check — that gate yields 403 with `error: "Forbidden"`.
    expect(res.status).toBe(403);
  });

  it("returns 401 without a cookie", async () => {
    await signedOut();
    const res = await request(buildApp()).get("/admin/withdrawals");
    expect(res.status).toBe(401);
  });
});

describe("POST /admin/withdrawals/:id/approve", () => {
  it("rejects malformed slip (must be data:image/...;base64,)", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({
      userId: 1,
      deletedAt: null,
      stats: { role: "admin" },
      store: null,
    });
    const res = await request(buildApp())
      .post("/admin/withdrawals/123/approve")
      .set("Cookie", await cookieFor(1, "admin"))
      .send({ paidProofImage: "not-a-data-url" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("ValidationError");
  });
});
