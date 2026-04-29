/**
 * Phase 17.1 — settings + wallet foundation tests.
 *
 *   GET  /settings                          public read, returns flags
 *   PATCH /admin/settings                   admin-only, updates flags
 *   GET  /wallet                            auth-only, returns balance + flag
 *   GET  /wallet/transactions               auth-only, returns ledger
 *   POST /admin/users/:id/grant-coins       admin-only, credits coins + audits
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { cookieFor } from "./_authMock.js";

vi.mock("../src/db/prisma.js", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    systemSetting: {
      findUnique: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    wallet: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    walletTransaction: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn(async (cb: any) => {
      // Provide the same mocked client to the transaction callback.
      const { prisma } = await import("../src/db/prisma.js");
      return cb(prisma);
    }),
  },
}));

vi.mock("../src/lib/auth.js", () => {
  const getSession = vi.fn(async () => null);
  const signInEmail = vi.fn(async () => new Response("", { status: 200 }));
  const signOut = vi.fn(async () => new Response("", { status: 200 }));
  const handler = vi.fn(async () => new Response("", { status: 404 }));
  return { auth: { api: { getSession, signInEmail, signOut }, handler } };
});

const { prisma } = await import("../src/db/prisma.js");
const { buildApp } = await import("../src/app.js");

beforeEach(async () => {
  const { signedOut } = await import("./_authMock.js");
  await signedOut();
  vi.clearAllMocks();
  // Default: settings row returned with seed values.
  (prisma.systemSetting.findUnique as any).mockResolvedValue({
    id: 1,
    walletEnabled: false,
    chatEnabled: true,
    promptpayId: "0812345678",
    updatedAt: new Date("2026-04-29T00:00:00Z"),
  });
});

describe("GET /settings", () => {
  it("returns the current flags (public, no auth required)", async () => {
    const res = await request(buildApp()).get("/settings");
    expect(res.status).toBe(200);
    expect(res.body.settings).toMatchObject({
      walletEnabled: false,
      chatEnabled: true,
      promptpayId: "0812345678",
    });
  });
});

describe("PATCH /admin/settings", () => {
  it("returns 401 without auth", async () => {
    const res = await request(buildApp())
      .patch("/admin/settings")
      .send({ walletEnabled: true });
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-admin auth", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({
      userId: 7,
      deletedAt: null,
      stats: { role: "buyer" },
      store: null,
    });
    const res = await request(buildApp())
      .patch("/admin/settings")
      .set("Cookie", await cookieFor(7))
      .send({ walletEnabled: true });
    expect(res.status).toBe(403);
  });

  it("happy: admin flips walletEnabled, updated row returned, audit row written", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({
      userId: 1,
      deletedAt: null,
      stats: { role: "admin" },
      store: null,
    });
    (prisma.systemSetting.update as any).mockResolvedValue({
      id: 1,
      walletEnabled: true,
      chatEnabled: true,
      promptpayId: "0812345678",
      updatedAt: new Date(),
    });
    const res = await request(buildApp())
      .patch("/admin/settings")
      .set("Cookie", await cookieFor(1, "admin"))
      .send({ walletEnabled: true });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.settings.walletEnabled).toBe(true);
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "system.settings.update",
        targetType: "system_setting",
        targetId: 1,
        meta: { walletEnabled: { from: false, to: true } },
      }),
    });
  });

  it("returns 400 EmptyPatch when body has no recognised keys", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({
      userId: 1,
      deletedAt: null,
      stats: { role: "admin" },
      store: null,
    });
    const res = await request(buildApp())
      .patch("/admin/settings")
      .set("Cookie", await cookieFor(1, "admin"))
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("EmptyPatch");
  });
});

describe("GET /wallet", () => {
  it("returns 401 without auth", async () => {
    const res = await request(buildApp()).get("/wallet");
    expect(res.status).toBe(401);
  });

  it("happy: balance + walletEnabled flag", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({
      userId: 7,
      deletedAt: null,
      stats: { role: "buyer" },
      store: null,
    });
    (prisma.wallet.findUnique as any).mockResolvedValue({
      walletId: 1,
      userId: 7,
      balance: 1500,
      updatedAt: new Date(),
    });
    const res = await request(buildApp())
      .get("/wallet")
      .set("Cookie", await cookieFor(7));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ balance: 1500, walletEnabled: false });
  });

  it("returns 0 balance for users who never had a wallet row", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({
      userId: 7,
      deletedAt: null,
      stats: { role: "buyer" },
      store: null,
    });
    (prisma.wallet.findUnique as any).mockResolvedValue(null);
    const res = await request(buildApp())
      .get("/wallet")
      .set("Cookie", await cookieFor(7));
    expect(res.status).toBe(200);
    expect(res.body.balance).toBe(0);
  });
});

describe("POST /admin/users/:id/grant-coins", () => {
  it("returns 401 without auth", async () => {
    const res = await request(buildApp())
      .post("/admin/users/9/grant-coins")
      .send({ amount: 100, reason: "demo" });
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-admin", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({
      userId: 7,
      deletedAt: null,
      stats: { role: "buyer" },
      store: null,
    });
    const res = await request(buildApp())
      .post("/admin/users/9/grant-coins")
      .set("Cookie", await cookieFor(7))
      .send({ amount: 100, reason: "demo" });
    expect(res.status).toBe(403);
  });

  it("happy: credits target user, returns balanceAfter, writes admin.wallet.grant audit", async () => {
    // requireAuth() pull
    (prisma.user.findUnique as any).mockImplementation(({ where }: any) => {
      if (where.userId === 1) return { userId: 1, deletedAt: null, stats: { role: "admin" }, store: null };
      if (where.userId === 9) return { userId: 9, deletedAt: null };
      return null;
    });
    (prisma.wallet.findUnique as any).mockResolvedValue({ walletId: 9, userId: 9, balance: 0 });
    (prisma.wallet.update as any).mockResolvedValue({ walletId: 9, userId: 9, balance: 500 });
    (prisma.walletTransaction.create as any).mockResolvedValue({});
    (prisma.auditLog.create as any).mockResolvedValue({});

    const res = await request(buildApp())
      .post("/admin/users/9/grant-coins")
      .set("Cookie", await cookieFor(1, "admin"))
      .send({ amount: 500, reason: "presentation demo top-up" });

    expect(res.status).toBe(200);
    expect(res.body.balanceAfter).toBe(500);
    expect(prisma.walletTransaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 9,
        type: "grant",
        amount: 500,
        balanceAfter: 500,
        reference: "admin-grant:1",
      }),
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "admin.wallet.grant",
        targetType: "user",
        targetId: 9,
        meta: expect.objectContaining({ amount: 500, reason: "presentation demo top-up" }),
      }),
    });
  });

  it("returns 400 ValidationError on negative amount", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({
      userId: 1,
      deletedAt: null,
      stats: { role: "admin" },
      store: null,
    });
    const res = await request(buildApp())
      .post("/admin/users/9/grant-coins")
      .set("Cookie", await cookieFor(1, "admin"))
      .send({ amount: -50, reason: "boom" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("ValidationError");
  });
});
