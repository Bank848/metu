/**
 * Phase 22 / 26 — security hardening tests.
 *
 *   • Helmet ships standard hardening headers on every response,
 *     even on 401 / 404 paths (no auth needed).
 *
 * Phase 26 — dropped the message-route profanity + rate-limit suites
 * after the messaging surface was removed. The profanity util itself
 * stays in the codebase (used by reviews, product questions had been
 * a consumer too) and is exercised indirectly through review tests.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

vi.mock("../src/db/prisma.js", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
  },
}));

vi.mock("../src/lib/auth.js", () => {
  const getSession = vi.fn(async () => null);
  const signInEmail = vi.fn(async () => new Response("", { status: 200 }));
  const signOut = vi.fn(async () => new Response("", { status: 200 }));
  const handler = vi.fn(async () => new Response("", { status: 404 }));
  return { auth: { api: { getSession, signInEmail, signOut }, handler } };
});

vi.mock("../src/services/settings.service.js", () => ({
  getSettings: vi.fn(async () => ({
    favoritesEnabled: true,
    platformFeePercent: 5,
    updatedAt: new Date(),
    googleEnabled: false,
  })),
}));

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
