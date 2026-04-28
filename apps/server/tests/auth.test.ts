/**
 * Auth resource — covers the high-leverage paths:
 *   • POST /auth/login   happy + 401 (wrong password) + 401 (missing user)
 *   • POST /auth/register 409 (duplicate email) + happy
 *   • GET  /auth/me      401 when no cookie
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import bcrypt from "bcryptjs";

vi.mock("../src/db/prisma.js", () => ({
  prisma: {
    $queryRaw: vi.fn(),
    $transaction: vi.fn(async (ops: any[]) => Promise.all(ops)),
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    cart: {
      create: vi.fn(),
    },
    passwordResetToken: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    auditLog: { create: vi.fn() },
  },
}));

const { prisma } = await import("../src/db/prisma.js");
const { buildApp } = await import("../src/app.js");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /auth/login", () => {
  it("returns 200 + sets cookie on valid credentials", async () => {
    const hash = await bcrypt.hash("Buyer#123", 4);
    (prisma.user.findUnique as any).mockResolvedValue({
      userId: 7,
      email: "buyer@metu.dev",
      password: hash,
      deletedAt: null,
      stats: { role: "buyer" },
      carts: [{ cartId: 1 }],
    });

    const res = await request(buildApp())
      .post("/auth/login")
      .send({ email: "buyer@metu.dev", password: "Buyer#123" });

    expect(res.status).toBe(200);
    expect(res.body.user.userId).toBe(7);
    expect(res.body.user.password).toBeUndefined();
    expect(res.headers["set-cookie"]?.[0]).toMatch(/^metu_auth=/);
  });

  it("returns 401 on wrong password", async () => {
    const hash = await bcrypt.hash("RealPassword", 4);
    (prisma.user.findUnique as any).mockResolvedValue({
      userId: 7,
      email: "buyer@metu.dev",
      password: hash,
      deletedAt: null,
      stats: { role: "buyer" },
      carts: [],
    });
    const res = await request(buildApp())
      .post("/auth/login")
      .send({ email: "buyer@metu.dev", password: "WrongPassword" });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("InvalidCredentials");
  });

  it("returns 401 (not 404) on unknown email — doesn't leak account state", async () => {
    (prisma.user.findUnique as any).mockResolvedValue(null);
    const res = await request(buildApp())
      .post("/auth/login")
      .send({ email: "ghost@metu.dev", password: "anything123" });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("InvalidCredentials");
  });
});

describe("POST /auth/register", () => {
  it("returns 409 when email is already taken", async () => {
    // First call (username dup check) returns null, second (email
    // dup check) returns a row.
    (prisma.user.findUnique as any)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ userId: 99, email: "taken@metu.dev" });
    const res = await request(buildApp())
      .post("/auth/register")
      .send({
        username: "newone",
        email: "taken@metu.dev",
        password: "Newone#123",
        firstName: "New",
        lastName: "One",
      });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe("Conflict");
  });

  it("rejects profanity in display fields", async () => {
    const res = await request(buildApp())
      .post("/auth/register")
      .send({
        username: "niiggaboy",
        email: "boy@metu.dev",
        password: "Boy#1234",
        firstName: "First",
        lastName: "Last",
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("ProfanityRejected");
  });
});

describe("GET /auth/me", () => {
  it("returns 401 without a cookie", async () => {
    const res = await request(buildApp()).get("/auth/me");
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Unauthorized");
  });

  it("forgot-password always returns 200 + generic message (no enum leak)", async () => {
    // Email NOT in DB
    (prisma.user.findUnique as any).mockResolvedValue(null);
    const res1 = await request(buildApp())
      .post("/auth/forgot-password")
      .send({ email: "ghost@metu.dev" });
    expect(res1.status).toBe(200);
    expect(res1.body.message).toMatch(/if that email is registered/i);

    // Email IS in DB — same response shape, but a token was created
    // server-side (and an email "sent" via the console provider).
    (prisma.user.findUnique as any).mockResolvedValue({
      userId: 7,
      email: "buyer@metu.dev",
      firstName: "Thana",
      deletedAt: null,
    });
    const res2 = await request(buildApp())
      .post("/auth/forgot-password")
      .send({ email: "buyer@metu.dev" });
    expect(res2.status).toBe(200);
    expect(res2.body.message).toBe(res1.body.message);
    expect(prisma.passwordResetToken.create).toHaveBeenCalled();
  });

  it("reset-password rejects expired/missing token with 400 InvalidToken", async () => {
    (prisma.passwordResetToken.findUnique as any).mockResolvedValue(null);
    const res = await request(buildApp())
      .post("/auth/reset-password")
      .send({ token: "x".repeat(40), newPassword: "newpass1" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("InvalidToken");
  });

  it("never leaks the bcrypt hash on a successful read", async () => {
    // Mint a real cookie so requireAuth() resolves the user, then
    // verify the password field is stripped from the response.
    const jwt = await import("jsonwebtoken");
    const token = jwt.default.sign(
      { uid: 7, role: "buyer" },
      process.env.JWT_SECRET ?? "dev-only-fallback-secret",
      { expiresIn: "1h" },
    );
    (prisma.user.findUnique as any).mockResolvedValue({
      userId: 7,
      email: "buyer@metu.dev",
      password: "$2a$10$shouldNeverEscape",
      deletedAt: null,
      stats: { role: "buyer" },
      store: null,
    });
    const res = await request(buildApp())
      .get("/auth/me")
      .set("Cookie", `metu_auth=${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.userId).toBe(7);
    expect(res.body.user.password).toBeUndefined();
  });
});
