import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

vi.mock("../src/db/prisma.js", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    order: { findUnique: vi.fn(), update: vi.fn() },
    auditLog: { findFirst: vi.fn(), create: vi.fn() },
    $transaction: vi.fn(async (fn: any) => fn({ order: { update: vi.fn() } })),
  },
}));

vi.mock("../src/lib/auth.js", () => {
  const getSession = vi.fn(async () => null);
  const signInEmail = vi.fn(async () => new Response("", { status: 200 }));
  const signOut = vi.fn(async () => new Response("", { status: 200 }));
  const handler = vi.fn(async () => new Response("", { status: 404 }));
  return { auth: { api: { getSession, signInEmail, signOut }, handler } };
});

const { prisma } = await import("../src/db/prisma.js");
const { buildApp } = await import("../src/app.js");
const { signedInAs, signedOut } = await import("./_authMock.js");

const cookie = "better-auth.session_token=fake-test-cookie";

beforeEach(async () => {
  vi.clearAllMocks();
  await signedInAs(7);
  (prisma.user.findUnique as any).mockResolvedValue({
    userId: 7,
    stats: { role: "buyer" },
    store: null,
  });
  (prisma.auditLog.create as any).mockResolvedValue({});
  (prisma.order.update as any).mockResolvedValue({});
  (prisma.$transaction as any).mockImplementation(async (fn: any) => {
    return fn({
      order: { update: prisma.order.update },
    });
  });
});

describe("buyer reclaims a gift order", () => {
  it("returns 401 when not signed in", async () => {
    await signedOut();
    const res = await request(buildApp()).post("/orders/42/reclaim-gift");
    expect(res.status).toBe(401);
  });

  it("returns 404 when the order doesn't belong to the caller", async () => {
    (prisma.order.findUnique as any).mockResolvedValue({
      orderId: 42,
      userId: 99,
      giftRecipientEmail: "friend@example.com",
      status: "paid",
    });
    const res = await request(buildApp())
      .post("/orders/42/reclaim-gift")
      .set("Cookie", cookie);
    expect(res.status).toBe(404);
  });

  it("returns 404 when the order isn't a gift", async () => {
    (prisma.order.findUnique as any).mockResolvedValue({
      orderId: 42,
      userId: 7,
      giftRecipientEmail: null,
      status: "paid",
    });
    const res = await request(buildApp())
      .post("/orders/42/reclaim-gift")
      .set("Cookie", cookie);
    expect(res.status).toBe(404);
  });

  it("returns 409 InvalidStatus when the order is still pending", async () => {
    (prisma.order.findUnique as any).mockResolvedValue({
      orderId: 42,
      userId: 7,
      giftRecipientEmail: "friend@example.com",
      status: "pending",
    });
    const res = await request(buildApp())
      .post("/orders/42/reclaim-gift")
      .set("Cookie", cookie);
    expect(res.status).toBe(409);
    expect(res.body.error).toBe("InvalidStatus");
  });

  it("returns 409 RecipientAlreadyViewed when an order.gift.viewed audit row exists", async () => {
    (prisma.order.findUnique as any).mockResolvedValue({
      orderId: 42,
      userId: 7,
      giftRecipientEmail: "friend@example.com",
      status: "paid",
    });
    (prisma.auditLog.findFirst as any).mockResolvedValue({ logId: 1 });
    const res = await request(buildApp())
      .post("/orders/42/reclaim-gift")
      .set("Cookie", cookie);
    expect(res.status).toBe(409);
    expect(res.body.error).toBe("RecipientAlreadyViewed");
    // The block path also writes a reclaim_blocked audit row for SOC.
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "order.gift.reclaim_blocked",
          targetType: "order",
          targetId: 42,
        }),
      }),
    );
    expect(prisma.order.update).not.toHaveBeenCalled();
  });

  it("happy path nulls the gift fields and emits the reclaimed audit row", async () => {
    (prisma.order.findUnique as any).mockResolvedValue({
      orderId: 42,
      userId: 7,
      giftRecipientEmail: "friend@example.com",
      status: "paid",
    });
    (prisma.auditLog.findFirst as any).mockResolvedValue(null);

    const res = await request(buildApp())
      .post("/orders/42/reclaim-gift")
      .set("Cookie", cookie);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(prisma.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { orderId: 42 },
        data: { giftRecipientEmail: null, giftMessage: null },
      }),
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "order.gift.reclaimed_by_buyer",
          targetType: "order",
          targetId: 42,
          actorId: 7,
        }),
      }),
    );
  });

  it("masks the recipient email via sha256 in the audit meta (no raw address persisted)", async () => {
    (prisma.order.findUnique as any).mockResolvedValue({
      orderId: 42,
      userId: 7,
      giftRecipientEmail: "Friend@Example.com",
      status: "paid",
    });
    (prisma.auditLog.findFirst as any).mockResolvedValue(null);

    await request(buildApp())
      .post("/orders/42/reclaim-gift")
      .set("Cookie", cookie);

    const auditCall = (prisma.auditLog.create as any).mock.calls.find(
      ([arg]: any) => arg?.data?.action === "order.gift.reclaimed_by_buyer",
    );
    expect(auditCall).toBeDefined();
    const meta = auditCall[0].data.meta;
    expect(typeof meta.recipient_hash).toBe("string");
    expect(meta.recipient_hash).toHaveLength(64); // sha256 hex
    expect(meta.recipient_hash).not.toContain("Friend");
    expect(meta.recipient_hash).not.toContain("@");
  });
});
