import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

vi.mock("../src/db/prisma.js", () => ({
  prisma: {
    $queryRaw: vi.fn(),
    category: { findMany: vi.fn() },
  },
}));

const { prisma } = await import("../src/db/prisma.js");
const { buildApp } = await import("../src/app.js");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /categories", () => {
  it("returns the alphabetised list", async () => {
    (prisma.category.findMany as any).mockResolvedValue([
      { categoryId: 1, categoryName: "3D Models" },
      { categoryId: 2, categoryName: "Fonts" },
    ]);
    const res = await request(buildApp()).get("/categories");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].categoryName).toBe("3D Models");
  });
});
