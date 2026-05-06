import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

// Stripe must look configured to the route or it short-circuits 503.
process.env.STRIPE_SECRET_KEY = "sk_test_mock";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_mock";

// Build the Stripe.Event objects the handler ultimately consumes.
const constructEvent = vi.fn();

vi.mock("../src/services/stripe.service.js", async () => {
  const actual = await vi.importActual<typeof import("../src/services/stripe.service.js")>(
    "../src/services/stripe.service.js",
  );
  return {
    ...actual,
    isConfigured: () => true,
    getClient: () => ({
      webhooks: { constructEvent },
      paymentIntents: { update: vi.fn() },
      refunds: { create: vi.fn() },
    }),
  };
});

// Build a single prisma mock object so $transaction can re-use the same
// auditLog/order/store mocks when the route runs `prisma.$transaction(
// async (tx) => { tx.auditLog.findFirst(...) })`. Without this the
// route-side advisory-lock transaction couldn't see the same `findFirst`
// vi.fn the tests configure in beforeEach.
const prismaMock: any = {
  auditLog: { findFirst: vi.fn(), create: vi.fn() },
  order: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  store: { updateMany: vi.fn() },
  $executeRawUnsafe: vi.fn(async () => 0),
};
prismaMock.$transaction = vi.fn(async (cb: (tx: any) => Promise<unknown>) => cb(prismaMock));

vi.mock("../src/db/prisma.js", () => ({
  prisma: prismaMock,
}));

vi.mock("../src/services/orders.service.js", () => ({
  finalizeOrder: vi.fn(async () => undefined),
  clearCartAfterPayment: vi.fn(async () => undefined),
}));

vi.mock("../src/lib/auth.js", () => ({
  auth: {
    api: { getSession: vi.fn(async () => null), signInEmail: vi.fn(), signOut: vi.fn() },
    handler: vi.fn(),
  },
}));

const { prisma } = await import("../src/db/prisma.js");
const { buildApp } = await import("../src/app.js");

beforeEach(() => {
  vi.clearAllMocks();
  // Default: event hasn't been processed before.
  (prisma.auditLog.findFirst as any).mockResolvedValue(null);
});

const PI_PAID_BODY = JSON.stringify({ id: "evt_test_1", type: "payment_intent.succeeded" });

describe("POST /api/webhooks/stripe — signature gates", () => {
  it("400 MissingSignature when the stripe-signature header is absent", async () => {
    const res = await request(buildApp())
      .post("/api/webhooks/stripe")
      .set("Content-Type", "application/json")
      .send(PI_PAID_BODY);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("MissingSignature");
  });

  it("400 InvalidSignature when constructEvent throws", async () => {
    constructEvent.mockImplementation(() => {
      throw new Error("bad sig");
    });
    const res = await request(buildApp())
      .post("/api/webhooks/stripe")
      .set("Content-Type", "application/json")
      .set("stripe-signature", "t=123,v1=garbage")
      .send(PI_PAID_BODY);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("InvalidSignature");
  });
});

describe("POST /api/webhooks/stripe — idempotency", () => {
  it("returns idempotent:true when the event id was already processed", async () => {
    constructEvent.mockReturnValue({
      id: "evt_dup_1",
      type: "payment_intent.succeeded",
      data: { object: { id: "pi_x", metadata: {}, amount_received: 0, latest_charge: null } },
    });
    (prisma.auditLog.findFirst as any).mockResolvedValue({ logId: 1 });

    const res = await request(buildApp())
      .post("/api/webhooks/stripe")
      .set("Content-Type", "application/json")
      .set("stripe-signature", "t=1,v1=mock")
      .send(JSON.stringify({}));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: true, idempotent: true });
    expect(prisma.order.update).not.toHaveBeenCalled();
  });
});

describe("POST /api/webhooks/stripe — payment_intent.succeeded", () => {
  it("rejects when amount_received differs from order.totalPrice (audit + no flip)", async () => {
    constructEvent.mockReturnValue({
      id: "evt_mismatch",
      type: "payment_intent.succeeded",
      data: {
        object: {
          id: "pi_mismatch",
          metadata: { orderId: "42" },
          amount_received: 9900, // Stripe says 99 THB
          latest_charge: "ch_x",
        },
      },
    });
    (prisma.order.findUnique as any).mockResolvedValue({
      totalPrice: { toString: () => "150.00" }, // Decimal — order says 150 THB
      status: "pending",
    });

    const res = await request(buildApp())
      .post("/api/webhooks/stripe")
      .set("Content-Type", "application/json")
      .set("stripe-signature", "t=1,v1=mock")
      .send(JSON.stringify({}));

    expect(res.status).toBe(200);
    // The order MUST stay pending — a flip-to-paid here would mean we
    // fulfil orders for the wrong amount.
    expect(prisma.order.update).not.toHaveBeenCalled();
    // Audit row records the mismatch for manual review.
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "stripe.amount_mismatch",
          targetType: "order",
          targetId: 42,
        }),
      }),
    );
  });

  it("flips order to paid when amount matches", async () => {
    constructEvent.mockReturnValue({
      id: "evt_ok",
      type: "payment_intent.succeeded",
      data: {
        object: {
          id: "pi_ok",
          metadata: { orderId: "55" },
          amount_received: 15000,
          latest_charge: "ch_ok",
        },
      },
    });
    (prisma.order.findUnique as any).mockResolvedValue({
      totalPrice: "150.00",
      status: "pending",
      userId: 7,
    });

    const res = await request(buildApp())
      .post("/api/webhooks/stripe")
      .set("Content-Type", "application/json")
      .set("stripe-signature", "t=1,v1=mock")
      .send(JSON.stringify({}));

    expect(res.status).toBe(200);
    expect(prisma.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { orderId: 55 },
        data: expect.objectContaining({ status: "paid", stripeChargeId: "ch_ok" }),
      }),
    );
  });

  it("is idempotent when order is already paid (no double-update, just finalize retry)", async () => {
    const { finalizeOrder } = await import("../src/services/orders.service.js");
    constructEvent.mockReturnValue({
      id: "evt_replay",
      type: "payment_intent.succeeded",
      data: {
        object: {
          id: "pi_replay",
          metadata: { orderId: "77" },
          amount_received: 5000,
          latest_charge: "ch_replay",
        },
      },
    });
    (prisma.order.findUnique as any).mockResolvedValue({
      totalPrice: "50.00",
      status: "paid",
    });

    const res = await request(buildApp())
      .post("/api/webhooks/stripe")
      .set("Content-Type", "application/json")
      .set("stripe-signature", "t=1,v1=mock")
      .send(JSON.stringify({}));

    expect(res.status).toBe(200);
    expect(prisma.order.update).not.toHaveBeenCalled();
    expect(finalizeOrder).toHaveBeenCalledWith(77);
  });

  it("does nothing when orderId metadata is missing/zero", async () => {
    constructEvent.mockReturnValue({
      id: "evt_no_order",
      type: "payment_intent.succeeded",
      data: {
        object: {
          id: "pi_orphan",
          metadata: {},
          amount_received: 1000,
          latest_charge: null,
        },
      },
    });
    const res = await request(buildApp())
      .post("/api/webhooks/stripe")
      .set("Content-Type", "application/json")
      .set("stripe-signature", "t=1,v1=mock")
      .send(JSON.stringify({}));

    expect(res.status).toBe(200);
    expect(prisma.order.findUnique).not.toHaveBeenCalled();
    expect(prisma.order.update).not.toHaveBeenCalled();
  });
});

describe("POST /api/webhooks/stripe — charge.refunded", () => {
  it("partial refund leaves status unchanged but writes refund metadata", async () => {
    constructEvent.mockReturnValue({
      id: "evt_partial_refund",
      type: "charge.refunded",
      data: {
        object: {
          id: "ch_x",
          payment_intent: "pi_partial",
          amount: 10000,
          amount_refunded: 4000,
          refunds: { data: [{ id: "re_partial" }] },
        },
      },
    });
    (prisma.order.findFirst as any).mockResolvedValue({
      orderId: 88,
      stripeAmountReceived: 10000,
    });
    const res = await request(buildApp())
      .post("/api/webhooks/stripe")
      .set("Content-Type", "application/json")
      .set("stripe-signature", "t=1,v1=mock")
      .send(JSON.stringify({}));
    expect(res.status).toBe(200);
    const updateCall = (prisma.order.update as any).mock.calls[0][0];
    expect(updateCall.where).toEqual({ orderId: 88 });
    expect(updateCall.data.stripeAmountRefunded).toBe(4000);
    expect(updateCall.data.stripeRefundId).toBe("re_partial");
    expect(updateCall.data.status).toBeUndefined(); // partial — status untouched
  });

  it("full refund flips status to refunded", async () => {
    constructEvent.mockReturnValue({
      id: "evt_full_refund",
      type: "charge.refunded",
      data: {
        object: {
          id: "ch_full",
          payment_intent: "pi_full",
          amount: 5000,
          amount_refunded: 5000,
          refunds: { data: [{ id: "re_full" }] },
        },
      },
    });
    (prisma.order.findFirst as any).mockResolvedValue({
      orderId: 99,
      stripeAmountReceived: 5000,
    });
    await request(buildApp())
      .post("/api/webhooks/stripe")
      .set("Content-Type", "application/json")
      .set("stripe-signature", "t=1,v1=mock")
      .send(JSON.stringify({}));
    const updateCall = (prisma.order.update as any).mock.calls[0][0];
    expect(updateCall.data.status).toBe("refunded");
  });
});
