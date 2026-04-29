/**
 * Q&A resource tests — covers the high-leverage paths:
 *   • GET    /products/:productId/questions   public, no auth
 *   • POST   /products/:productId/questions   401 without cookie
 *   • PATCH  /questions/:id                   asker can edit body
 *                                             non-admin/non-asker → 403
 *   • PATCH  /questions/:id/answer            non-seller-of-store → 403
 *                                             admin can answer ANY question
 *   • DELETE /questions/:id                   admin delete writes audit
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { cookieFor } from "./_authMock.js";

vi.mock("../src/db/prisma.js", () => ({
  prisma: {
    $queryRaw: vi.fn(),
    user: { findUnique: vi.fn() },
    product: { findFirst: vi.fn() },
    productQuestion: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    auditLog: { create: vi.fn() },
  },
}));

vi.mock("../src/lib/auth.js", () => {
  const getSession = vi.fn(async () => null);
  const signInEmail = vi.fn(async () => {
    const headers = new Headers();
    headers.append("set-cookie", "better-auth.session_token=fake; Path=/; HttpOnly; SameSite=Lax");
    return new Response("", { status: 200, headers });
  });
  const signOut = vi.fn(async () => {
    const headers = new Headers();
    headers.append("set-cookie", "better-auth.session_token=; Path=/; Max-Age=0");
    return new Response("", { status: 200, headers });
  });
  const handler = vi.fn(async () => new Response("", { status: 404 }));
  return { auth: { api: { getSession, signInEmail, signOut }, handler } };
});

const { prisma } = await import("../src/db/prisma.js");
const { buildApp } = await import("../src/app.js");


beforeEach(async () => {
    const { signedOut } = await import("./_authMock.js");
    await signedOut();
  vi.clearAllMocks();
  // Default user for requireAuth() — buyer #7, no store.
  (prisma.user.findUnique as any).mockResolvedValue({
    userId: 7,
    deletedAt: null,
    stats: { role: "buyer" },
    store: null,
  });
});

describe("GET /products/:productId/questions (public)", () => {
  it("returns the list with no auth", async () => {
    (prisma.productQuestion.findMany as any).mockResolvedValue([
      {
        questionId: 1,
        productId: 100,
        body: "How big is it?",
        asker: {
          userId: 7,
          username: "buyer",
          firstName: "T",
          lastName: "S",
          profileImage: null,
        },
        answerer: null,
      },
    ]);
    const res = await request(buildApp()).get("/products/100/questions");
    expect(res.status).toBe(200);
    expect(res.body.questions).toHaveLength(1);
    expect(res.body.questions[0].asker.username).toBe("buyer");
  });
});

describe("POST /products/:productId/questions (auth)", () => {
  it("returns 401 without cookie", async () => {
    const res = await request(buildApp())
      .post("/products/100/questions")
      .send({ body: "Is this in stock?" });
    expect(res.status).toBe(401);
  });

  it("returns 404 for soft-deleted/orphan product", async () => {
    (prisma.product.findFirst as any).mockResolvedValue(null);
    const res = await request(buildApp())
      .post("/products/9999/questions")
      .set("Cookie", await cookieFor(7))
      .send({ body: "Hello?" });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("ProductNotFound");
  });
});

describe("PATCH /questions/:id (edit gates)", () => {
  it("non-admin / non-asker editing the body → 403", async () => {
    (prisma.productQuestion.findUnique as any).mockResolvedValue({
      questionId: 555,
      productId: 100,
      askerId: 99, // someone else
      body: "old",
      answer: null,
      answererId: null,
    });
    const res = await request(buildApp())
      .patch("/questions/555")
      .set("Cookie", await cookieFor(7))
      .send({ body: "evil edit" });
    expect(res.status).toBe(403);
  });

  it("non-admin trying to edit ANSWER → 403 (must use /answer endpoint)", async () => {
    (prisma.productQuestion.findUnique as any).mockResolvedValue({
      questionId: 555,
      productId: 100,
      askerId: 7,        // viewer is the asker
      body: "Q",
      answer: null,
      answererId: null,
    });
    const res = await request(buildApp())
      .patch("/questions/555")
      .set("Cookie", await cookieFor(7))
      .send({ answer: "sneaky" });
    expect(res.status).toBe(403);
  });
});

describe("PATCH /questions/:id/answer (seller / admin)", () => {
  it("non-seller-of-store → 403", async () => {
    // Buyer #7 has no store
    (prisma.productQuestion.findUnique as any).mockResolvedValue({
      questionId: 555,
      product: { storeId: 9 },
    });
    const res = await request(buildApp())
      .patch("/questions/555/answer")
      .set("Cookie", await cookieFor(7))
      .send({ answer: "I'm not the seller" });
    expect(res.status).toBe(403);
  });

  it("admin can answer ANY question", async () => {
    // Admin #40 — bypasses the store ownership check.
    (prisma.user.findUnique as any).mockResolvedValue({
      userId: 40,
      deletedAt: null,
      stats: { role: "admin" },
      store: null,
    });
    (prisma.productQuestion.findUnique as any).mockResolvedValue({
      questionId: 555,
      product: { storeId: 9 },
    });
    (prisma.productQuestion.update as any).mockResolvedValue({
      questionId: 555,
      answer: "From admin",
    });
    const res = await request(buildApp())
      .patch("/questions/555/answer")
      .set("Cookie", await cookieFor(40, "admin"))
      .send({ answer: "From admin" });
    expect(res.status).toBe(200);
    expect(res.body.question.answer).toBe("From admin");
  });
});

describe("DELETE /questions/:id (admin → audit row)", () => {
  it("admin deleting a non-self question writes AuditLog 'question.delete'", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({
      userId: 40,
      deletedAt: null,
      stats: { role: "admin" },
      store: null,
    });
    (prisma.productQuestion.findUnique as any).mockResolvedValue({
      questionId: 555,
      productId: 100,
      askerId: 7,
      body: "rude",
      answer: null,
      answererId: null,
    });
    (prisma.productQuestion.delete as any).mockResolvedValue({ questionId: 555 });
    const res = await request(buildApp())
      .delete("/questions/555")
      .set("Cookie", await cookieFor(40, "admin"));
    expect(res.status).toBe(200);
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actorId: 40,
          action: "question.delete",
          targetId: 555,
        }),
      }),
    );
  });
});
