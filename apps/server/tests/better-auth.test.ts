/**
 * better-auth plumbing smoke test — confirms the catch-all route is
 * mounted and the runtime boots cleanly. Does NOT exercise sign-in
 * flows (those need real Postgres or extensive table mocking).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

vi.mock("../src/db/prisma.js", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    // better-auth's adapter touches these on getSession; mock empty.
    session: { findFirst: vi.fn().mockResolvedValue(null) },
    account: { findFirst: vi.fn().mockResolvedValue(null) },
  },
}));

// DON'T mock the auth module — this file exercises the REAL catch-all
// integration mounted via auth.handler in app.ts. Other tests mock it
// for speed, but here we need the real handler to verify the route.

const { buildApp } = await import("../src/app.js");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("better-auth catch-all", () => {
  it("GET /api/auth/better/get-session returns null session for anonymous request", async () => {
    const res = await request(buildApp()).get("/api/auth/better/get-session");
    // better-auth returns 200 with {} or { session: null, user: null }
    // depending on version — accept either as long as it didn't 404.
    expect(res.status).toBe(200);
    if (res.body && Object.keys(res.body).length > 0) {
      expect(res.body.session ?? null).toBeNull();
    }
  });

  it("404s for unknown /api/auth/better/<random> paths", async () => {
    const res = await request(buildApp()).get("/api/auth/better/this-is-not-a-real-endpoint");
    // 404 or 405 — both non-500 are acceptable.
    expect([404, 405]).toContain(res.status);
  });
});
