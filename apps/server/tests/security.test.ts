/**
 * Phase 22 — security hardening tests.
 *
 *   • Helmet ships standard hardening headers on every response,
 *     even on 401 / 404 paths (no auth needed).
 *   • Rate-limited routes return 429 with Retry-After once the
 *     bucket fills.
 *   • Profanity filter rejects message bodies before the Neon
 *     write goes through.
 *
 * Together these are the easy wins. TOTP step-up + sessions UI
 * scaffolding land in a follow-up phase.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { cookieFor, signedOut } from "./_authMock.js";

vi.mock("../src/db/prisma.js", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    message: { create: vi.fn(), count: vi.fn(), findMany: vi.fn(), updateMany: vi.fn() },
  },
}));

vi.mock("../src/lib/auth.js", () => {
  const getSession = vi.fn(async () => null);
  const signInEmail = vi.fn(async () => new Response("", { status: 200 }));
  const signOut = vi.fn(async () => new Response("", { status: 200 }));
  const handler = vi.fn(async () => new Response("", { status: 404 }));
  return { auth: { api: { getSession, signInEmail, signOut }, handler } };
});

// Constant settings so message send doesn't fail with a missing
// systemSetting mock.
vi.mock("../src/services/settings.service.js", () => ({
  getSettings: vi.fn(async () => ({
    walletEnabled: false,
    chatEnabled: true,
    favoritesEnabled: true,
    promptpayId: "",
    platformFeePercent: 5,
    withdrawalFeePercent: 0,
    updatedAt: new Date(),
    googleEnabled: false,
  })),
}));

const { prisma } = await import("../src/db/prisma.js");
const { buildApp } = await import("../src/app.js");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Helmet — security headers", () => {
  // /auth/me is a cheap auth-gated endpoint that doesn't need a DB
  // mock — it short-circuits with 401 before any prisma call. We only
  // care that the security headers are attached to the response, not
  // the status code.
  it("ships HSTS on a 401 path (no DB mock needed)", async () => {
    const res = await request(buildApp()).get("/auth/me");
    expect(res.headers["strict-transport-security"]).toBeDefined();
  });

  it("ships X-Content-Type-Options nosniff", async () => {
    const res = await request(buildApp()).get("/auth/me");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
  });

  it("ships CSP", async () => {
    const res = await request(buildApp()).get("/auth/me");
    expect(res.headers["content-security-policy"]).toBeDefined();
  });
});

describe("Profanity filter — message body", () => {
  it("rejects a banned word with 400 ProfanityRejected", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({
      userId: 7,
      deletedAt: null,
      stats: { role: "buyer" },
      store: null,
    });
    const res = await request(buildApp())
      .post("/messages")
      .set("Cookie", await cookieFor(7))
      .send({ recipientId: 9, body: "you are a fucking idiot" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("ProfanityRejected");
    expect(prisma.message.create).not.toHaveBeenCalled();
  });

  it("accepts clean bodies through to the Prisma write", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({
      userId: 7,
      deletedAt: null,
      stats: { role: "buyer" },
      store: null,
    });
    (prisma.message.create as any).mockResolvedValue({
      messageId: 1,
      senderId: 7,
      recipientId: 9,
      body: "When will the order ship?",
      orderId: null,
      productId: null,
      readAt: null,
      createdAt: new Date(),
    });
    const res = await request(buildApp())
      .post("/messages")
      .set("Cookie", await cookieFor(7))
      .send({ recipientId: 9, body: "When will the order ship?" });
    expect(res.status).toBe(200);
    expect(prisma.message.create).toHaveBeenCalled();
  });
});

describe("Rate limiter — POST /messages", () => {
  it("returns 429 with Retry-After once 30/min is exhausted", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({
      userId: 99,
      deletedAt: null,
      stats: { role: "buyer" },
      store: null,
    });
    (prisma.message.create as any).mockImplementation((args: any) =>
      Promise.resolve({
        messageId: 1,
        senderId: 99,
        recipientId: args.data.recipientId,
        body: args.data.body,
        orderId: null,
        productId: null,
        readAt: null,
        createdAt: new Date(),
      }),
    );
    const cookie = await cookieFor(99);
    const app = buildApp();
    let lastStatus = 0;
    let lastRetryAfter: string | undefined;
    // Fire 31 sequential sends — the 31st should land 429.
    for (let i = 0; i < 31; i++) {
      const res = await request(app)
        .post("/messages")
        .set("Cookie", cookie)
        .send({ recipientId: 100, body: `msg ${i}` });
      lastStatus = res.status;
      lastRetryAfter = res.headers["retry-after"];
    }
    expect(lastStatus).toBe(429);
    expect(lastRetryAfter).toBeDefined();
  });
});
