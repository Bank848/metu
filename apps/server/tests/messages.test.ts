/**
 * Messages resource tests:
 *   • GET    /messages              401 / inbox happy
 *   • GET    /messages?with=N       401 / thread happy + marks read
 *   • POST   /messages              401 / 400 validation / 400 self-send / happy
 *   • GET    /messages/unread       401 / count
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { cookieFor } from "./_authMock.js";

vi.mock("../src/db/prisma.js", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    message: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
    },
  },
}));

// Phase 19 — POST /messages now calls getSettings() to gate on the
// chatEnabled flag. Stub the settings service with a constant so the
// existing happy/error cases don't need a Prisma systemSetting mock,
// and add explicit ChatDisabled coverage at the bottom of the file.
const settingsMock = vi.hoisted(() => ({
  getSettingsMock: vi.fn(async () => ({
    walletEnabled: false,
    chatEnabled: true,
    favoritesEnabled: true,
    promptpayId: "",
    updatedAt: new Date(),
    googleEnabled: false,
  })),
}));
vi.mock("../src/services/settings.service.js", () => ({
  getSettings: settingsMock.getSettingsMock,
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


const userSummary = {
  userId: 7,
  username: "buyer",
  firstName: "T",
  lastName: "S",
  profileImage: null,
};
const partnerSummary = {
  userId: 9,
  username: "seller",
  firstName: "Sell",
  lastName: "Er",
  profileImage: null,
};

beforeEach(async () => {
    const { signedOut } = await import("./_authMock.js");
    await signedOut();
  vi.clearAllMocks();
  // Default user for requireAuth() — buyer #7, no store.
  (prisma.user.findUnique as any).mockImplementation(({ where }: any) =>
    where.userId === 7
      ? Promise.resolve({
          userId: 7,
          deletedAt: null,
          stats: { role: "buyer" },
          store: null,
        })
      : Promise.resolve(partnerSummary),
  );
});

describe("GET /messages (inbox)", () => {
  it("returns 401 without cookie", async () => {
    const res = await request(buildApp()).get("/messages");
    expect(res.status).toBe(401);
  });

  it("groups recent messages by partner with unread count", async () => {
    const now = new Date("2026-04-28T10:00:00Z");
    const earlier = new Date("2026-04-28T09:00:00Z");
    (prisma.message.findMany as any).mockResolvedValue([
      // Most recent: partner sent me, unread
      {
        messageId: 3,
        senderId: 9, recipientId: 7,
        body: "hello", readAt: null, createdAt: now,
        sender: partnerSummary, recipient: userSummary,
      },
      // I sent partner earlier
      {
        messageId: 2,
        senderId: 7, recipientId: 9,
        body: "ping", readAt: new Date("2026-04-28T08:00:00Z"), createdAt: earlier,
        sender: userSummary, recipient: partnerSummary,
      },
    ]);

    const res = await request(buildApp())
      .get("/messages")
      .set("Cookie", await cookieFor(7));
    expect(res.status).toBe(200);
    expect(res.body.threads).toHaveLength(1);
    expect(res.body.threads[0].partner.userId).toBe(9);
    expect(res.body.threads[0].unread).toBe(1);
    expect(res.body.threads[0].lastMessage).toBe("hello");
  });
});

describe("GET /messages?with=N (thread)", () => {
  it("returns the messages and marks the partner's as read", async () => {
    (prisma.message.findMany as any).mockResolvedValue([
      {
        messageId: 1,
        senderId: 9, recipientId: 7,
        body: "hi", readAt: null, createdAt: new Date(),
        sender: partnerSummary,
      },
    ]);
    (prisma.message.updateMany as any).mockResolvedValue({ count: 1 });

    const res = await request(buildApp())
      .get("/messages?with=9")
      .set("Cookie", await cookieFor(7));
    expect(res.status).toBe(200);
    expect(res.body.messages).toHaveLength(1);
    expect(res.body.other.userId).toBe(9);
    expect(prisma.message.updateMany).toHaveBeenCalledWith({
      where: { senderId: 9, recipientId: 7, readAt: null },
      data: { readAt: expect.any(Date) },
    });
  });
});

describe("POST /messages", () => {
  it("returns 401 without cookie", async () => {
    const res = await request(buildApp())
      .post("/messages")
      .send({ recipientId: 9, body: "hi" });
    expect(res.status).toBe(401);
  });

  it("rejects validation errors with 400", async () => {
    const res = await request(buildApp())
      .post("/messages")
      .set("Cookie", await cookieFor(7))
      .send({ recipientId: 9 }); // missing body
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("ValidationError");
  });

  it("rejects self-send with 400", async () => {
    const res = await request(buildApp())
      .post("/messages")
      .set("Cookie", await cookieFor(7))
      .send({ recipientId: 7, body: "hi self" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("SelfSend");
  });

  it("creates the message + returns it", async () => {
    const created = {
      messageId: 42,
      senderId: 7, recipientId: 9,
      body: "hi", orderId: null, productId: null,
      readAt: null, createdAt: new Date(),
    };
    (prisma.message.create as any).mockResolvedValue(created);
    const res = await request(buildApp())
      .post("/messages")
      .set("Cookie", await cookieFor(7))
      .send({ recipientId: 9, body: "hi" });
    expect(res.status).toBe(200);
    expect(res.body.message.messageId).toBe(42);
    expect(prisma.message.create).toHaveBeenCalledWith({
      data: { senderId: 7, recipientId: 9, body: "hi", orderId: null, productId: null },
    });
  });

  // Phase 19 — admin-controlled global toggle. POST is gated; GET inbox /
  // thread / unread are deliberately NOT gated so users can still read
  // history when chat is disabled.
  it("returns 403 ChatDisabled when chatEnabled=false", async () => {
    settingsMock.getSettingsMock.mockResolvedValueOnce({
      walletEnabled: false,
      chatEnabled: false,
      favoritesEnabled: true,
      promptpayId: "",
      updatedAt: new Date(),
      googleEnabled: false,
    });
    const res = await request(buildApp())
      .post("/messages")
      .set("Cookie", await cookieFor(7))
      .send({ recipientId: 9, body: "hi" });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe("ChatDisabled");
    // The mock `prisma.message.create` must NOT have been called — the
    // gate runs before the service layer.
    expect(prisma.message.create).not.toHaveBeenCalled();
  });
});

describe("GET /messages/unread", () => {
  it("returns 401 without cookie", async () => {
    const res = await request(buildApp()).get("/messages/unread");
    expect(res.status).toBe(401);
  });

  it("returns the count for the current user", async () => {
    (prisma.message.count as any).mockResolvedValue(3);
    const res = await request(buildApp())
      .get("/messages/unread")
      .set("Cookie", await cookieFor(7));
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(3);
    expect(prisma.message.count).toHaveBeenCalledWith({
      where: { recipientId: 7, readAt: null },
    });
  });
});
