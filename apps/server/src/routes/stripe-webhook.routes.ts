/**
 * Stripe webhook receiver. MUST be mounted before express.json() and
 * with express.raw() so Stripe signature verification sees raw bytes.
 * Idempotency: events are recorded in AuditLog keyed on event.id.
 */
import { Router, raw } from "express";
import type { Request, Response, NextFunction } from "express";
import Stripe from "stripe";
import { prisma } from "../db/prisma.js";
import { getClient, isConfigured } from "../services/stripe.service.js";
import { finalizeOrder } from "../services/orders.service.js";

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

    // Skip events already processed.
    const existing = await prisma.auditLog.findFirst({
      where: { action: "stripe.event.processed", meta: { path: ["eventId"], equals: event.id } },
      select: { logId: true },
    });
    if (existing) return res.json({ received: true, idempotent: true });

    try {
      await handleEvent(event);
      await prisma.auditLog.create({
        data: {
          action: "stripe.event.processed",
          targetType: "stripe_event",
          targetId: 0,
          meta: { eventId: event.id, type: event.type } as never,
        },
      });
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

  const chargeId = typeof pi.latest_charge === "string" ? pi.latest_charge : null;

  await prisma.order.update({
    where: { orderId },
    data: {
      status: "paid",
      stripeChargeId: chargeId,
      stripeAmountReceived: pi.amount_received,
    },
  });

  // finalizeOrder is idempotent so Stripe retries are safe.
  await finalizeOrder(orderId);
}

async function onPaymentIntentFailed(event: Stripe.Event) {
  const pi = event.data.object as Stripe.PaymentIntent;
  const orderId = Number(pi.metadata?.orderId ?? 0);
  if (!orderId) return;
  await prisma.order.update({
    where: { orderId },
    data: { status: "cancelled" },
  });
}

async function onChargeRefunded(event: Stripe.Event) {
  const charge = event.data.object as Stripe.Charge;
  const piId = typeof charge.payment_intent === "string" ? charge.payment_intent : null;
  if (!piId) return;

  const order = await prisma.order.findFirst({
    where: { stripePaymentIntentId: piId },
    select: { orderId: true, stripeAmountReceived: true },
  });
  if (!order) return;

  const lastRefund = charge.refunds?.data[0];
  await prisma.order.update({
    where: { orderId: order.orderId },
    data: {
      stripeRefundId: lastRefund?.id ?? null,
      stripeAmountRefunded: charge.amount_refunded,
      // Only fully-refunded orders flip status; partials stay `paid`.
      status: charge.amount === charge.amount_refunded ? "refunded" : undefined,
    },
  });
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

export default router;
