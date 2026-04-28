import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

vi.mock("../src/db/prisma.js", () => ({
  prisma: {
    $queryRaw: vi.fn(),
    productTag: { findMany: vi.fn() },
  },
}));

const { prisma } = await import("../src/db/prisma.js");
const { buildApp } = await import("../src/app.js");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /tags", () => {
  it("returns the alphabetised tag list", async () => {
    (prisma.productTag.findMany as any).mockResolvedValue([
      { tagId: 1, tagName: "commercial-use" },
      { tagId: 2, tagName: "thai-style" },
    ]);
    const res = await request(buildApp()).get("/tags");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].tagName).toBe("commercial-use");
  });
});
