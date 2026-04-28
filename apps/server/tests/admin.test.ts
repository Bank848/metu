/**
 * Admin resource tests:
 *   • Auth + role gates (401 / 403 buyer)
 *   • GET    /admin/users            list + filter passthrough
 *   • PATCH  /admin/users/:id        role change happy + 400 SelfDemoteForbidden + audit row
 *   • DELETE /admin/users/:id        soft-delete vs ban (with reason) + 400 SelfDeleteForbidden
 *   • GET    /admin/stores           list (deletedAt:null filter)
 *   • DELETE /admin/stores/:id       audit row
 *   • GET    /admin/stats            composite payload
 *   • DELETE /admin/transactions/:id snapshot audit
 *   • POST   /admin/transactions/:id/refund happy + 400 NotPurchase
 *   • GET    /admin/reports/:name    happy on each + 404 UnknownReport
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";

vi.mock("../src/db/prisma.js", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
    userStats: { findUnique: vi.fn(), upsert: vi.fn() },
    store: { findMany: vi.fn(), count: vi.fn(), update: vi.fn() },
    product: { count: vi.fn() },
    productReview: { count: vi.fn() },
    order: { count: vi.fn(), updateMany: vi.fn() },
    transaction: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      delete: vi.fn(),
      create: vi.fn(),
    },
    auditLog: { create: vi.fn() },
    $queryRaw: vi.fn(),
    $transaction: vi.fn(),
  },
}));

const { prisma } = await import("../src/db/prisma.js");
const { buildApp } = await import("../src/app.js");

const SECRET = process.env.JWT_SECRET ?? "dev-only-fallback-secret";
function cookieFor(uid: number, role: "buyer" | "seller" | "admin") {
  return `metu_auth=${jwt.sign({ uid, role }, SECRET, { expiresIn: "1h" })}`;
}

const adminUser = {
  userId: 1,
  deletedAt: null,
  stats: { role: "admin" },
  store: null,
};
const buyerUser = {
  userId: 9,
  deletedAt: null,
  stats: { role: "buyer" },
  store: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  (prisma.user.findUnique as any).mockImplementation(({ where }: any) => {
    if (where.userId === 1) return Promise.resolve(adminUser);
    if (where.userId === 9) return Promise.resolve(buyerUser);
    return Promise.resolve(null);
  });
});

describe("auth + role gates", () => {
  it("401 without cookie on every admin endpoint", async () => {
    const app = buildApp();
    for (const m of [
      ["get", "/admin/users"],
      ["get", "/admin/stores"],
      ["get", "/admin/stats"],
      ["get", "/admin/reports/orders-by-status"],
    ] as const) {
      const res = await (request(app) as any)[m[0]](m[1]);
      expect(res.status).toBe(401);
    }
  });

  it("403 Forbidden when a buyer tries an admin route", async () => {
    const res = await request(buildApp())
      .get("/admin/stats")
      .set("Cookie", cookieFor(9, "buyer"));
    expect(res.status).toBe(403);
  });
});

describe("GET /admin/users", () => {
  it("strips password from every row + returns pagination meta", async () => {
    (prisma.user.findMany as any).mockResolvedValue([
      {
        userId: 7,
        username: "x",
        email: "x@x.com",
        password: "$2a$hashed",
        firstName: "X",
        lastName: "Y",
        country: null,
        stats: { role: "buyer" },
        store: null,
      },
    ]);
    (prisma.user.count as any).mockResolvedValue(1);
    const res = await request(buildApp())
      .get("/admin/users?q=x&page=1&pageSize=20")
      .set("Cookie", cookieFor(1, "admin"));
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].password).toBeUndefined();
    expect(res.body.totalPages).toBe(1);
  });
});

describe("PATCH /admin/users/:id (role change)", () => {
  it("400 SelfDemoteForbidden when admin removes own admin role", async () => {
    const res = await request(buildApp())
      .patch("/admin/users/1") // self
      .set("Cookie", cookieFor(1, "admin"))
      .send({ role: "buyer" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("SelfDemoteForbidden");
  });

  it("happy: writes upsert + audit row with from/to meta", async () => {
    (prisma.userStats.findUnique as any).mockResolvedValue({ role: "buyer" });
    (prisma.userStats.upsert as any).mockResolvedValue({});
    (prisma.auditLog.create as any).mockResolvedValue({});
    const res = await request(buildApp())
      .patch("/admin/users/9")
      .set("Cookie", cookieFor(1, "admin"))
      .send({ role: "seller" });
    expect(res.status).toBe(200);
    expect(prisma.userStats.upsert).toHaveBeenCalledWith({
      where: { userId: 9 },
      update: { role: "seller" },
      create: { userId: 9, role: "seller" },
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "user.role_change",
        targetType: "user",
        targetId: 9,
        meta: { from: "buyer", to: "seller" },
      }),
    });
  });
});

describe("DELETE /admin/users/:id (soft-delete vs ban)", () => {
  it("400 SelfDeleteForbidden when admin tries to delete self", async () => {
    const res = await request(buildApp())
      .delete("/admin/users/1")
      .set("Cookie", cookieFor(1, "admin"))
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("SelfDeleteForbidden");
  });

  it("no reason → 'user.delete' audit, deletedAt only", async () => {
    (prisma.user.update as any).mockResolvedValue({});
    (prisma.auditLog.create as any).mockResolvedValue({});
    const res = await request(buildApp())
      .delete("/admin/users/9")
      .set("Cookie", cookieFor(1, "admin"))
      .send({});
    expect(res.status).toBe(200);
    const update = (prisma.user.update as any).mock.calls[0][0];
    expect(update.data.deletedAt).toBeInstanceOf(Date);
    expect(update.data.bannedAt).toBeUndefined();
    expect(update.data.bannedReason).toBeUndefined();
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "user.delete" }),
    });
  });

  it("with reason → 'user.ban' audit, deletedAt + bannedAt + bannedReason", async () => {
    (prisma.user.update as any).mockResolvedValue({});
    (prisma.auditLog.create as any).mockResolvedValue({});
    const res = await request(buildApp())
      .delete("/admin/users/9")
      .set("Cookie", cookieFor(1, "admin"))
      .send({ reason: "Racial slur in display name" });
    expect(res.status).toBe(200);
    const update = (prisma.user.update as any).mock.calls[0][0];
    expect(update.data.deletedAt).toBeInstanceOf(Date);
    expect(update.data.bannedAt).toBeInstanceOf(Date);
    expect(update.data.bannedReason).toBe("Racial slur in display name");
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "user.ban",
        meta: { reason: "Racial slur in display name" },
      }),
    });
  });
});

describe("GET /admin/stores", () => {
  it("filters deletedAt:null + nested products count too", async () => {
    (prisma.store.findMany as any).mockResolvedValue([{ storeId: 11 }]);
    const res = await request(buildApp())
      .get("/admin/stores")
      .set("Cookie", cookieFor(1, "admin"));
    expect(res.status).toBe(200);
    const call = (prisma.store.findMany as any).mock.calls[0][0];
    expect(call.where).toEqual({ deletedAt: null });
    expect(call.include._count.select.products.where).toEqual({
      deletedAt: null,
    });
  });
});

describe("DELETE /admin/stores/:id", () => {
  it("soft-deletes + writes 'store.delete' audit", async () => {
    (prisma.store.update as any).mockResolvedValue({});
    (prisma.auditLog.create as any).mockResolvedValue({});
    const res = await request(buildApp())
      .delete("/admin/stores/11")
      .set("Cookie", cookieFor(1, "admin"));
    expect(res.status).toBe(200);
    expect(prisma.store.update).toHaveBeenCalledWith({
      where: { storeId: 11 },
      data: { deletedAt: expect.any(Date) },
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "store.delete" }),
    });
  });
});

describe("GET /admin/stats", () => {
  it("composes the KPI payload (gmv coerced from $queryRaw text)", async () => {
    (prisma.user.count as any).mockResolvedValue(50);
    (prisma.store.count as any).mockResolvedValue(8);
    (prisma.product.count as any).mockResolvedValue(40);
    (prisma.productReview.count as any).mockResolvedValue(100);
    (prisma.order.count as any).mockResolvedValueOnce(20).mockResolvedValueOnce(3);
    (prisma.transaction.findMany as any).mockResolvedValue([]);
    (prisma.$queryRaw as any)
      .mockResolvedValueOnce([{ total: "12345.67" }])
      .mockResolvedValueOnce([
        { day: "2026-04-28", revenue: "100", order_count: 2n },
      ]);
    const res = await request(buildApp())
      .get("/admin/stats")
      .set("Cookie", cookieFor(1, "admin"));
    expect(res.status).toBe(200);
    expect(res.body.users).toBe(50);
    expect(res.body.gmv).toBe(12345.67);
    expect(res.body.pendingOrders).toBe(3);
    expect(res.body.daily[0].orderCount).toBe(2);
  });
});

describe("DELETE /admin/transactions/:id", () => {
  it("hard-deletes + audit captures the snapshot", async () => {
    (prisma.transaction.findUnique as any).mockResolvedValue({
      userId: 9,
      transactionType: "purchase",
      totalAmount: "100.00",
    });
    (prisma.transaction.delete as any).mockResolvedValue({});
    (prisma.auditLog.create as any).mockResolvedValue({});
    const res = await request(buildApp())
      .delete("/admin/transactions/42")
      .set("Cookie", cookieFor(1, "admin"));
    expect(res.status).toBe(200);
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "transaction.delete",
        meta: { userId: 9, type: "purchase", amount: 100 },
      }),
    });
  });
});

describe("POST /admin/transactions/:id/refund", () => {
  it("400 NotPurchase for refund/payout types", async () => {
    (prisma.transaction.findUnique as any).mockResolvedValue({
      transactionType: "refund",
      userId: 9,
      totalAmount: "100",
      orders: [],
    });
    const res = await request(buildApp())
      .post("/admin/transactions/42/refund")
      .set("Cookie", cookieFor(1, "admin"));
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("NotPurchase");
  });

  it("happy: $transaction + refund audit row", async () => {
    (prisma.transaction.findUnique as any).mockResolvedValue({
      transactionType: "purchase",
      userId: 9,
      totalAmount: "100.00",
      orders: [{ orderId: 1 }, { orderId: 2 }],
    });
    (prisma.$transaction as any).mockResolvedValue([{}, {}]);
    (prisma.auditLog.create as any).mockResolvedValue({});
    const res = await request(buildApp())
      .post("/admin/transactions/42/refund")
      .set("Cookie", cookieFor(1, "admin"));
    expect(res.status).toBe(200);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "transaction.refund",
        meta: expect.objectContaining({ ordersAffected: 2 }),
      }),
    });
  });
});

describe("GET /admin/reports/:name", () => {
  it("404 UnknownReport for an unknown name", async () => {
    const res = await request(buildApp())
      .get("/admin/reports/banana-bread")
      .set("Cookie", cookieFor(1, "admin"));
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("UnknownReport");
  });

  it("orders-by-status returns sql + rows", async () => {
    (prisma.$queryRaw as any).mockResolvedValue([
      { status: "paid", count: 5n },
      { status: "pending", count: 1n },
    ]);
    const res = await request(buildApp())
      .get("/admin/reports/orders-by-status")
      .set("Cookie", cookieFor(1, "admin"));
    expect(res.status).toBe(200);
    expect(res.body.sql).toContain("orders");
    expect(res.body.rows[0].count).toBe(5);
  });
});

// =============================================================================
//  Phase 15.5 — admin force-password-reset
// =============================================================================
describe("POST /admin/users/:id/require-password-reset (Phase 15.5)", () => {
  it("403 for non-admin", async () => {
    // requireAuth's dual-stack does the user lookup BEFORE the role
    // check (Phase 14.2), so the buyer needs a real prisma user to
    // get past the 401 and reach the 403 forbidden gate.
    (prisma.user.findUnique as any).mockResolvedValue({
      userId: 7,
      deletedAt: null,
      stats: { role: "buyer" },
      store: null,
    });
    const res = await request(buildApp())
      .post("/admin/users/2/require-password-reset")
      .set("Cookie", cookieFor(7, "buyer"))
      .send({ value: true });
    expect(res.status).toBe(403);
  });

  it("400 SelfToggleForbidden when admin tries to flag themselves", async () => {
    // Admin id 1 toggling user 1 — caught by service-side guard.
    (prisma.user.update as any).mockResolvedValue({});
    const res = await request(buildApp())
      .post("/admin/users/1/require-password-reset")
      .set("Cookie", cookieFor(1, "admin"))
      .send({ value: true });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("SelfToggleForbidden");
  });

  it("400 ValidationError when body.value is missing or wrong type", async () => {
    const res = await request(buildApp())
      .post("/admin/users/2/require-password-reset")
      .set("Cookie", cookieFor(1, "admin"))
      .send({}); // no value
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("ValidationError");
  });

  it("happy: SET (value=true) updates User + writes audit row", async () => {
    (prisma.user.update as any).mockResolvedValue({});
    (prisma.auditLog.create as any).mockResolvedValue({});
    const res = await request(buildApp())
      .post("/admin/users/2/require-password-reset")
      .set("Cookie", cookieFor(1, "admin"))
      .send({ value: true });
    expect(res.status).toBe(200);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { userId: 2 },
      data: { requirePasswordReset: true },
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "user.require_password_reset.set",
        targetType: "user",
        targetId: 2,
      }),
    });
  });

  it("happy: CLEAR (value=false) writes the .clear audit variant", async () => {
    (prisma.user.update as any).mockResolvedValue({});
    (prisma.auditLog.create as any).mockResolvedValue({});
    const res = await request(buildApp())
      .post("/admin/users/2/require-password-reset")
      .set("Cookie", cookieFor(1, "admin"))
      .send({ value: false });
    expect(res.status).toBe(200);
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "user.require_password_reset.clear",
      }),
    });
  });
});

// =============================================================================
//  Phase 16.1 — store-suspended toggle
// =============================================================================
describe("POST /admin/stores/:id/suspend (Phase 16.1)", () => {
  it("400 ValidationError when body.value is missing or not boolean", async () => {
    const res = await request(buildApp())
      .post("/admin/stores/11/suspend")
      .set("Cookie", cookieFor(1, "admin"))
      .send({}); // no value
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("ValidationError");
  });

  it("happy: SET (value=true) sets suspendedAt to a Date + writes .suspend audit", async () => {
    (prisma.store.update as any).mockResolvedValue({});
    (prisma.auditLog.create as any).mockResolvedValue({});
    const res = await request(buildApp())
      .post("/admin/stores/11/suspend")
      .set("Cookie", cookieFor(1, "admin"))
      .send({ value: true });
    expect(res.status).toBe(200);
    const updateCall = (prisma.store.update as any).mock.calls[0][0];
    expect(updateCall.where.storeId).toBe(11);
    expect(updateCall.data.suspendedAt).toBeInstanceOf(Date);
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "store.suspend",
        targetType: "store",
        targetId: 11,
      }),
    });
  });

  it("happy: CLEAR (value=false) sets suspendedAt to null + writes .unsuspend audit", async () => {
    (prisma.store.update as any).mockResolvedValue({});
    (prisma.auditLog.create as any).mockResolvedValue({});
    const res = await request(buildApp())
      .post("/admin/stores/11/suspend")
      .set("Cookie", cookieFor(1, "admin"))
      .send({ value: false });
    expect(res.status).toBe(200);
    const updateCall = (prisma.store.update as any).mock.calls[0][0];
    expect(updateCall.data.suspendedAt).toBeNull();
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "store.unsuspend",
      }),
    });
  });
});
