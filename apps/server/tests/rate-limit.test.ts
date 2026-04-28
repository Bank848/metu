/**
 * Phase 15.1 — rate-limit middleware tests.
 *
 * Mounts a tiny throwaway Express app with a fresh limiter so we
 * can verify the boundary behaviour without contaminating the real
 * loginLimiter / registerLimiter singletons (which other tests share
 * via buildApp()). Same approach as the controller-layer tests:
 * isolate, mount, hit, assert.
 */
import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import { rateLimit } from "../src/middleware/rate-limit.js";
import { errorHandler } from "../src/middleware/error.js";

function makeApp(max: number, windowMs: number) {
  const app = express();
  app.set("trust proxy", true);
  app.get("/limited", rateLimit({ max, windowMs }), (_req, res) => {
    res.json({ ok: true });
  });
  app.use(errorHandler);
  return app;
}

describe("rateLimit middleware", () => {
  it("allows requests up to the limit, rejects the next with 429 + Retry-After", async () => {
    const app = makeApp(3, 60_000);
    // 3 happy requests
    for (let i = 0; i < 3; i++) {
      const res = await request(app).get("/limited");
      expect(res.status).toBe(200);
      expect(res.headers["x-ratelimit-limit"]).toBe("3");
      expect(res.headers["x-ratelimit-remaining"]).toBe(String(2 - i));
    }
    // 4th request — over the limit
    const blocked = await request(app).get("/limited");
    expect(blocked.status).toBe(429);
    expect(blocked.body.error).toBe("RateLimited");
    // Retry-After is rounded up to >= 1 second
    expect(Number(blocked.headers["retry-after"])).toBeGreaterThanOrEqual(1);
  });

  it("isolates state per limiter instance (separate routes don't share buckets)", async () => {
    const app = express();
    app.set("trust proxy", true);
    // Two SEPARATE limiter instances (different options objects) ⇒
    // separate WeakMap buckets. Hitting /a 2 times shouldn't count
    // against /b's quota.
    app.get("/a", rateLimit({ max: 2, windowMs: 60_000 }), (_req, res) => res.json({ where: "a" }));
    app.get("/b", rateLimit({ max: 2, windowMs: 60_000 }), (_req, res) => res.json({ where: "b" }));
    app.use(errorHandler);

    await request(app).get("/a");
    await request(app).get("/a");
    // /a is now at 2/2 — third would 429. /b should still be fresh.
    const overA = await request(app).get("/a");
    expect(overA.status).toBe(429);
    const okB = await request(app).get("/b");
    expect(okB.status).toBe(200);
  });

  it("isolates by IP key — different X-Forwarded-For addresses get separate buckets", async () => {
    const app = makeApp(2, 60_000);
    // First IP fills its bucket
    await request(app).get("/limited").set("X-Forwarded-For", "10.0.0.1");
    await request(app).get("/limited").set("X-Forwarded-For", "10.0.0.1");
    const overA = await request(app).get("/limited").set("X-Forwarded-For", "10.0.0.1");
    expect(overA.status).toBe(429);
    // Different IP starts at 0
    const okB = await request(app).get("/limited").set("X-Forwarded-For", "10.0.0.2");
    expect(okB.status).toBe(200);
  });

  it("re-allows requests after the window slides (using a tiny windowMs)", async () => {
    const app = makeApp(1, 50); // 1 request per 50ms
    const first = await request(app).get("/limited");
    expect(first.status).toBe(200);
    const blocked = await request(app).get("/limited");
    expect(blocked.status).toBe(429);

    // Wait past the window then retry — should be allowed again.
    await new Promise((r) => setTimeout(r, 80));
    const after = await request(app).get("/limited");
    expect(after.status).toBe(200);
  });
});
