/**
 * Reviews resource tests — covers the high-leverage paths:
 *   • POST /products/:productId/reviews  401 + happy + 404 on bad product
 *   • PATCH /reviews/:id                  403 on non-author / non-admin
 *   • DELETE /reviews/:id                 happy as admin (audit row written)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";

vi.mock("../src/db/prisma.js", () => ({
  prisma: {
    $queryRaw: vi.fn(),
    user: { findUnique: vi.fn() },
    product: { findFirst: vi.fn() },
    productReview: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    auditLog: { create: vi.fn() },
  },
}));

const { prisma } = await import("../src/db/prisma.js");
const { buildApp } = await import("../src/app.js");

const SECRET = process.env.JWT_SECRET ?? "dev-only-fallback-secret";
function cookieFor(uid: number, role: "buyer" | "seller" | "admin" = "buyer") {
  return `metu_auth=${jwt.sign({ uid, role }, SECRET, { expiresIn: "1h" })}`;
}

beforeEach(() => {
  vi.clearAllMocks();
  // Default: requireAuth() resolves user 7 (buyer).
  (prisma.user.findUnique as any).mockResolvedValue({
    userId: 7,
    deletedAt: null,
    stats: { role: "buyer" },
    store: null,
  });
});

describe("POST /products/:productId/reviews", () => {
  it("returns 401 without a cookie", async () => {
    const res = await request(buildApp())
      .post("/products/100/reviews")
      .send({ rating: 5, comment: "great" });
    expect(res.status).toBe(401);
  });

  it("returns 404 for a soft-deleted / orphan product", async () => {
    (prisma.product.findFirst as any).mockResolvedValue(null);
    const res = await request(buildApp())
      .post("/products/9999/reviews")
      .set("Cookie", cookieFor(7))
      .send({ rating: 5, comment: "great" });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("ProductNotFound");
  });

  it("creates a review on a valid product", async () => {
    (prisma.product.findFirst as any).mockResolvedValue({ productId: 100 });
    (prisma.productReview.create as any).mockResolvedValue({
      reviewId: 555,
      productId: 100,
      userId: 7,
      rating: 5,
      comment: "great",
      createdAt: new Date(),
      user: { userId: 7, firstName: "T", lastName: "S", profileImage: null, username: "buyer" },
    });
    const res = await request(buildApp())
      .post("/products/100/reviews")
      .set("Cookie", cookieFor(7))
      .send({ rating: 5, comment: "great" });
    expect(res.status).toBe(200);
    expect(res.body.review.reviewId).toBe(555);
  });
});

describe("PATCH /reviews/:id", () => {
  it("returns 403 when the editor is neither admin nor author", async () => {
    (prisma.productReview.findUnique as any).mockResolvedValue({
      reviewId: 555,
      userId: 99, // someone else
      productId: 100,
      rating: 4,
      comment: "ok",
    });
    const res = await request(buildApp())
      .patch("/reviews/555")
      .set("Cookie", cookieFor(7))
      .send({ rating: 1 });
    expect(res.status).toBe(403);
  });
});

describe("DELETE /reviews/:id (admin → audit row)", () => {
  it("admin deleting a non-self review writes an AuditLog entry", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({
      userId: 40,
      deletedAt: null,
      stats: { role: "admin" },
      store: null,
    });
    (prisma.productReview.findUnique as any).mockResolvedValue({
      reviewId: 555,
      userId: 7, // someone else
      productId: 100,
      rating: 1,
      comment: "trash talk",
    });
    (prisma.productReview.delete as any).mockResolvedValue({ reviewId: 555 });

    const res = await request(buildApp())
      .delete("/reviews/555")
      .set("Cookie", cookieFor(40, "admin"));

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actorId: 40,
          action: "review.delete",
          targetId: 555,
        }),
      }),
    );
  });
});
