/**
 * Stripe webhook receiver. MUST be mounted before express.json() and
 * with express.raw() so Stripe signature verification sees raw bytes.
 * Idempotency: events are recorded in AuditLog keyed on event.id.
 */
import { Router, raw } from "express";
import type { Request, Response, NextFunction } from "express";
import Stripe from "stripe";
import { Prisma } from "@prisma/client";
import { prisma } from "../db/prisma.js";
import { getClient, isConfigured } from "../services/stripe.service.js";
import { finalizeOrder, clearCartAfterPayment } from "../services/orders.service.js";

const router = Router();

router.post(
  "/",
  raw({ type: "application/json", limit: "1mb" }),
  async (req: Request, res: Response, next: NextFunction) => {
    if (!isConfigured()) {
      return res.status(503).json({ error: "StripeNotConfigured" });
    }
    const sig = req.header("stripe-signature");
    // Comma-separated list supports both account + connected sources.
    const rawSecret = process.env.STRIPE_WEBHOOK_SECRET ?? "";
    const candidateSecrets = rawSecret
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (!sig || candidateSecrets.length === 0) {
      return res.status(400).json({ error: "MissingSignature" });
    }

    let event: Stripe.Event | null = null;
    let lastErr: unknown = null;
    for (const secret of candidateSecrets) {
      try {
        event = getClient().webhooks.constructEvent(
          req.body as Buffer,
          sig,
          secret,
        );
        break;
      } catch (err) {
        lastErr = err;
      }
    }
    if (!event) {
      // eslint-disable-next-line no-console
      console.error("[stripe-webhook] signature verification failed against all configured secrets:", lastErr);
      return res.status(400).json({ error: "InvalidSignature" });
    }

    // Per-event idempotency via Postgres advisory transaction lock
    // keyed on a 32-bit hash of event.id. Lock auto-releases on commit.
    try {
      const result = await prisma.$transaction(async (tx) => {
        // FNV-1a 32-bit hash of event.id for pg_advisory_xact_lock(int).
        const lockKey = fnv1a32(event!.id);
        await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(${lockKey})`);

        const existing = await tx.auditLog.findFirst({
          where: { action: "stripe.event.processed", meta: { path: ["eventId"], equals: event!.id } },
          select: { logId: true },
        });
        if (existing) {
          // Concurrent retry won the lock first; bail out cleanly.
          return { idempotent: true as const };
        }
        await handleEvent(event!);
        await tx.auditLog.create({
          data: {
            action: "stripe.event.processed",
            targetType: "stripe_event",
            targetId: 0,
            meta: { eventId: event!.id, type: event!.type } as never,
          },
        });
        return { idempotent: false as const };
      }, {
        // Bump default 5s tx timeout — refund handlers can be slow.
        timeout: 30_000,
        maxWait: 10_000,
      });
      if (result.idempotent) {
        return res.json({ received: true, idempotent: true });
      }
      res.json({ received: true });
    } catch (err) {
      // 500 so Stripe retries.
      next(err);
    }
  },
);

async function handleEvent(event: Stripe.Event) {
  switch (event.type) {
    case "payment_intent.succeeded":      return onPaymentIntentSucceeded(event);
    case "payment_intent.payment_failed": return onPaymentIntentFailed(event);
    case "charge.refunded":                return onChargeRefunded(event);
    case "account.updated":                return onAccountUpdated(event);
    // payout.paid: audit only, no DB write.
    case "payout.paid":                    return onPayoutPaid(event);
    default: {
      // eslint-disable-next-line no-console
      console.log(`[stripe-webhook] unhandled event type: ${event.type}`);
    }
  }
}

async function onPaymentIntentSucceeded(event: Stripe.Event) {
  const pi = event.data.object as Stripe.PaymentIntent;
  const orderId = Number(pi.metadata?.orderId ?? 0);
  if (!orderId) return;

  // Confirm Stripe's charged amount matches the order total; on
  // mismatch flag for review instead of auto-finalising.
  const order = await prisma.order.findUnique({
    where: { orderId },
    select: { totalPrice: true, status: true, userId: true },
  });
  if (!order) return;
  // Idempotency for retried success events.
  if (order.status === "paid" || order.status === "fulfilled") {
    await finalizeOrder(orderId);
    return;
  }
  // Don't flip cancelled/refunded back to paid on a late PI succeed.
  if (order.status !== "pending") {
    await prisma.auditLog.create({
      data: {
        action: "stripe.late_pi_after_cancel",
        targetType: "order",
        targetId: orderId,
        meta: { piId: pi.id, orderStatus: order.status, amount: pi.amount_received },
      },
    });
    return;
  }
  // Mirror createPaymentIntent's floor() so legitimate charges match.
  const expectedSatang = Math.floor(Number(order.totalPrice) * 100);
  if (pi.amount_received !== expectedSatang) {
    // eslint-disable-next-line no-console
    console.error(
      `[stripe-webhook] amount mismatch order=${orderId} expected=${expectedSatang} got=${pi.amount_received} pi=${pi.id}`,
    );
    await prisma.auditLog.create({
      data: {
        action: "stripe.amount_mismatch",
        targetType: "order",
        targetId: orderId,
        meta: {
          paymentIntentId: pi.id,
          expected: expectedSatang,
          received: pi.amount_received,
        } as never,
      },
    });
    return; // do not flip to paid
  }

  const chargeId = typeof pi.latest_charge === "string" ? pi.latest_charge : null;

  await prisma.order.update({
    where: { orderId },
    data: {
      status: "paid",
      stripeChargeId: chargeId,
      stripeAmountReceived: pi.amount_received,
    },
  });

  // Stamp Transaction.date to payment-success time so the admin
  // widget sorts paid orders ahead of stale checkouts.
  await prisma.transaction.updateMany({
    where: {
      transactionType: "purchase",
      orders: { some: { orderId } },
    },
    data: { date: new Date() },
  });

  // Drop the purchased items from the buyer's active cart.
  await clearCartAfterPayment(order.userId, orderId).catch((err) => {
    // eslint-disable-next-line no-console
    console.warn("[stripe-webhook] clearCartAfterPayment failed (non-fatal):", err);
  });

  // finalizeOrder is idempotent so Stripe retries are safe.
  await finalizeOrder(orderId);
}

async function onPaymentIntentFailed(event: Stripe.Event) {
  const pi = event.data.object as Stripe.PaymentIntent;
  const orderId = Number(pi.metadata?.orderId ?? 0);
  if (!orderId) return;
  const DIGITAL_METHODS = new Set(["download", "email", "license_key", "streaming"]);
  // Cancel the order + restore non-digital stock in one tx.
  await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { orderId },
      select: { status: true, items: { select: { productItemId: true, quantity: true } } },
    });
    if (!order || order.status !== "pending") return;
    for (const item of order.items) {
      if (item.productItemId == null) continue;
      const pIt = await tx.productItem.findUnique({
        where: { productItemId: item.productItemId },
        select: { deliveryMethod: true },
      });
      if (!pIt || DIGITAL_METHODS.has(pIt.deliveryMethod)) continue;
      await tx.productItem.update({
        where: { productItemId: item.productItemId },
        data: { quantity: { increment: item.quantity } },
      });
    }
    await tx.order.update({ where: { orderId }, data: { status: "cancelled" } });
  });
}

async function onChargeRefunded(event: Stripe.Event) {
  const charge = event.data.object as Stripe.Charge;
  const piId = typeof charge.payment_intent === "string" ? charge.payment_intent : null;
  if (!piId) return;

  const order = await prisma.order.findFirst({
    where: { stripePaymentIntentId: piId },
    select: {
      orderId: true,
      userId: true,
      totalPrice: true,
      stripeAmountReceived: true,
      // stripeRefundId presence = in-app refund already booked a payout.
      stripeRefundId: true,
      status: true,
    },
  });
  if (!order) return;

  const lastRefund = charge.refunds?.data[0];
  const fullyRefunded = charge.amount === charge.amount_refunded;
  // Dashboard-originated refund: no in-app sentinel + not already refunded.
  const dashboardOriginated =
    fullyRefunded && !order.stripeRefundId && order.status !== "refunded";

  await prisma.order.update({
    where: { orderId: order.orderId },
    data: {
      stripeRefundId: lastRefund?.id ?? null,
      stripeAmountRefunded: charge.amount_refunded,
      // Only fully-refunded orders flip status; partials stay `paid`.
      status: fullyRefunded ? "refunded" : undefined,
    },
  });

  if (dashboardOriginated) {
    // Book a negative-payout Transaction (mirrors in-app refund flows).
    await prisma.transaction.create({
      data: {
        userId: order.userId,
        transactionType: "payout",
        totalAmount: new Prisma.Decimal(order.totalPrice).neg(),
      },
    });
  }
}

async function onAccountUpdated(event: Stripe.Event) {
  const acct = event.data.object as Stripe.Account;
  await prisma.store.updateMany({
    where: { stripeAccountId: acct.id },
    data: {
      stripePayoutsEnabled: Boolean(acct.payouts_enabled),
      stripeChargesEnabled: Boolean(acct.charges_enabled),
    },
  });
}

async function onPayoutPaid(_event: Stripe.Event) {
  // No-op: seller-wallet UI fetches payout history live from Stripe.
}

/** FNV-1a 32-bit hash. Used as advisory-lock key from event.id. */
function fnv1a32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  // Force into 32-bit signed range.
  return h | 0;
}

export default router;
