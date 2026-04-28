/**
 * Phase 14.1 — better-auth plumbing smoke test.
 *
 * Just confirms the catch-all route is mounted and the runtime
 * boots cleanly. Does NOT exercise sign-in flows yet — those need
 * the schema migration to land first (account/session/verification
 * tables) AND would either need real Postgres or extensive mocking
 * of better-auth's internal table layout.
 *
 * Phase 14.2 will add real flow tests against the migrated DB
 * (Mode A: better-auth owns the cookie).
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

const { buildApp } = await import("../src/app.js");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Phase 14.1 — better-auth catch-all", () => {
  it("GET /api/auth/better/get-session returns null session for anonymous request", async () => {
    const res = await request(buildApp()).get("/api/auth/better/get-session");
    // better-auth returns 200 with { } or { session: null, user: null }
    // depending on version — accept either as long as it didn't 404.
    expect(res.status).toBe(200);
    // No session cookie was sent, so we expect no `session` object
    // populated. Some versions return 200 with empty body, others
    // with explicit nulls — both are valid "anonymous" responses.
    if (res.body && Object.keys(res.body).length > 0) {
      expect(res.body.session ?? null).toBeNull();
    }
  });

  it("404s for unknown /api/auth/better/<random> paths", async () => {
    const res = await request(buildApp()).get("/api/auth/better/this-is-not-a-real-endpoint");
    // better-auth's catch-all handles unknown paths with 404 (or
    // sometimes 405 method-not-allowed). Both are non-500.
    expect([404, 405]).toContain(res.status);
  });
});
