import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

vi.mock("../src/db/prisma.js", () => ({
  prisma: {
    $queryRaw: vi.fn(),
    store: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    product: {
      findMany: vi.fn(),
    },
  },
}));

const { prisma } = await import("../src/db/prisma.js");
const { buildApp } = await import("../src/app.js");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /stores", () => {
  it("returns the store list", async () => {
    (prisma.store.findMany as any).mockResolvedValue([
      { storeId: 1, name: "Store one", _count: { products: 3 } },
    ]);
    const res = await request(buildApp()).get("/stores");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0].storeId).toBe(1);
  });
});

describe("GET /stores/:id", () => {
  it("returns 404 when the store does not exist", async () => {
    // Service now uses findFirst (filters out soft-deleted) + a
    // parallel product.findMany. Mock both.
    (prisma.store.findFirst as any).mockResolvedValue(null);
    (prisma.product.findMany as any).mockResolvedValue([]);
    const res = await request(buildApp()).get("/stores/9999");
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("StoreNotFound");
  });

  it("returns the BFF envelope when found", async () => {
    (prisma.store.findFirst as any).mockResolvedValue({
      storeId: 1,
      name: "Hello",
      owner: { firstName: "A", lastName: "B" },
    });
    (prisma.product.findMany as any).mockResolvedValue([]);
    const res = await request(buildApp()).get("/stores/1");
    expect(res.status).toBe(200);
    expect(res.body.store.storeId).toBe(1);
    expect(res.body.products).toEqual([]);
    expect(res.body.productCount).toBe(0);
  });
});
