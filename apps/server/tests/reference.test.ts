/**
 * Reference data tests — replaces the deleted legacy catalog.ts
 * router with a layered module. Two public endpoints, both
 * unauthenticated, both alphabetically sorted.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

vi.mock("../src/db/prisma.js", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    businessType: { findMany: vi.fn() },
    country: { findMany: vi.fn() },
  },
}));

const { prisma } = await import("../src/db/prisma.js");
const { buildApp } = await import("../src/app.js");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /business-types", () => {
  it("returns alphabetically-sorted list (no auth required)", async () => {
    (prisma.businessType.findMany as any).mockResolvedValue([
      { typeId: 1, name: "Solo" },
      { typeId: 2, name: "Studio" },
    ]);
    const res = await request(buildApp()).get("/business-types");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(prisma.businessType.findMany).toHaveBeenCalledWith({
      orderBy: { name: "asc" },
    });
  });
});

describe("GET /countries", () => {
  it("returns alphabetically-sorted list (no auth required)", async () => {
    (prisma.country.findMany as any).mockResolvedValue([
      { countryId: 1, name: "Thailand", countryCode: 66 },
    ]);
    const res = await request(buildApp()).get("/countries");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(prisma.country.findMany).toHaveBeenCalledWith({
      orderBy: { name: "asc" },
    });
  });
});
