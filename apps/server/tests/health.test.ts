/**
 * Smoke test for the health resource. Mocks Prisma's `$queryRaw` so
 * the test stays runtime-deterministic and doesn't need a live DB.
 *
 * Pattern repeated across every layered resource: mock the Prisma
 * client at module level → import `buildApp()` from app.ts → drive
 * with supertest. No port binding, no fixtures.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

vi.mock("../src/db/prisma.js", () => ({
  prisma: {
    $queryRaw: vi.fn(async () => [{ now: new Date() }]),
  },
}));

const { buildApp } = await import("../src/app.js");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /health", () => {
  it("returns ok + db connected", async () => {
    const res = await request(buildApp()).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.db).toBe("connected");
    expect(typeof res.body.pingMs).toBe("number");
  });
});
