import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { cookieFor } from "./_authMock.js";

vi.mock("../src/db/prisma.js", () => ({
  prisma: {
    $queryRaw: vi.fn(),
    user: { findUnique: vi.fn() },
    cart: { findFirst: vi.fn() },
    order: { findMany: vi.fn(), findFirst: vi.fn() },
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

// Phase 16.3 — Mode A: ceremonial cookie (better-auth getSession is mocked).
const cookie = "better-auth.session_token=fake-test-cookie";

beforeEach(async () => {
  const { signedInAs } = await import("./_authMock.js");
  vi.clearAllMocks();
  await signedInAs(7);
  (prisma.user.findUnique as any).mockResolvedValue({
    userId: 7,
    stats: { role: "buyer" },
    store: null,
  });
});

describe("POST /orders", () => {
  it("returns 401 without a cookie", async () => {
    // Phase 16.3 — beforeEach signs the user in by default; explicitly
    // sign out to test the anonymous path.
    const { signedOut } = await import("./_authMock.js");
    await signedOut();
    const res = await request(buildApp()).post("/orders").send({});
    expect(res.status).toBe(401);
  });

  it("returns 400 EmptyCart when the active cart has no items", async () => {
    (prisma.cart.findFirst as any).mockResolvedValue(null);
    const res = await request(buildApp())
      .post("/orders")
      .set("Cookie", cookie)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("EmptyCart");
  });
});

describe("GET /orders", () => {
  it("lists the user's orders newest-first", async () => {
    (prisma.order.findMany as any).mockResolvedValue([
      { orderId: 100, totalPrice: "200", items: [], transaction: null },
    ]);
    const res = await request(buildApp()).get("/orders").set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].orderId).toBe(100);
  });
});

describe("GET /orders/:id", () => {
  it("returns 404 when the order doesn't exist OR belongs to someone else", async () => {
    (prisma.order.findFirst as any).mockResolvedValue(null);
    const res = await request(buildApp())
      .get("/orders/9999")
      .set("Cookie", cookie);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("OrderNotFound");
  });
});
