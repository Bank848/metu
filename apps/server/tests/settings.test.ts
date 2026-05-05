/**
 * Phase 17.1 / 26 — settings tests (slimmed down).
 *   GET   /settings           public read, returns flags
 *   PATCH /admin/settings     admin-only, updates flags + writes audit
 * Phase 26 — dropped /wallet, /admin/users/:id/grant-coins suites
 * after the wallet/coin layer was removed in favour of Stripe Connect
 * (Phase 27).
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
    auditLog: { create: vi.fn() },
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
    favoritesEnabled: true,
    platformFeePercent: 5,
    updatedAt: new Date("2026-04-29T00:00:00Z"),
  });
});

describe("GET /settings", () => {
  it("returns the current flags (public, no auth required)", async () => {
    const res = await request(buildApp()).get("/settings");
    expect(res.status).toBe(200);
    expect(res.body.settings).toMatchObject({
      favoritesEnabled: true,
      platformFeePercent: 5,
      // Phase 17.x — derived from env at request time. In the test
      // env GOOGLE_CLIENT_ID is unset → googleEnabled is false.
      googleEnabled: false,
    });
  });
});

describe("PATCH /admin/settings", () => {
  it("returns 401 without auth", async () => {
    const res = await request(buildApp())
      .patch("/admin/settings")
      .send({ favoritesEnabled: false });
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-admin auth", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({
      userId: 7,
      stats: { role: "buyer" },
      store: null,
    });
    const res = await request(buildApp())
      .patch("/admin/settings")
      .set("Cookie", await cookieFor(7))
      .send({ favoritesEnabled: false });
    expect(res.status).toBe(403);
  });

  it("happy: admin flips favoritesEnabled, updated row returned, audit row written", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({
      userId: 1,
      stats: { role: "admin" },
      store: null,
    });
    (prisma.systemSetting.update as any).mockResolvedValue({
      id: 1,
      favoritesEnabled: false,
      platformFeePercent: 5,
      updatedAt: new Date(),
    });
    const res = await request(buildApp())
      .patch("/admin/settings")
      .set("Cookie", await cookieFor(1, "admin"))
      .send({ favoritesEnabled: false });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.settings.favoritesEnabled).toBe(false);
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "system.settings.update",
        targetType: "system_setting",
        targetId: 1,
        meta: { favoritesEnabled: { from: true, to: false } },
      }),
    });
  });

  it("returns 400 EmptyPatch when body has no recognised keys", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({
      userId: 1,
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
