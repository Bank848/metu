/**
 * Phase 27 — Stripe webhook receiver.
 *
 * Mounted in app.ts BEFORE express.json() and with a per-route
 * `express.raw()` body parser. Stripe signs the raw bytes — any
 * JSON parsing before signature verification trips the verifier
 * and we reject every event as a forgery.
 *
 * Idempotency: every event already has a unique `event.id`. We
 * record successful processing as an AuditLog row keyed on that
 * id, then check for it before re-processing. The constraint
 * "อย่าเพิ่ม table" rules out a dedicated WebhookEvent table —
 * AuditLog is the closest fit and we already log destructive
 * actions for the demo trail.
 */
import { Router, raw } from "express";
import type { Request, Response, NextFunction } from "express";
import Stripe from "stripe";
import { prisma } from "../db/prisma.js";
import { getClient, isConfigured } from "../services/stripe.service.js";

const router = Router();

router.post(
  "/",
  // Raw body up to 1 MB — Stripe's largest payload (charge.dispute.created
  // with attached evidence file metadata) tops out around 100 KB.
  raw({ type: "application/json", limit: "1mb" }),
  async (req: Request, res: Response, next: NextFunction) => {
    if (!isConfigured()) {
      // Webhook must always 503 cleanly when Stripe isn't configured —
      // Stripe's retry logic backs off on 5xx, our logs stay clean.
      return res.status(503).json({ error: "StripeNotConfigured" });
    }
    const sig = req.header("stripe-signature");
    // Support multiple signing secrets — one webhook endpoint can be
    // shared across "Your account" and "Connected accounts" sources,
    // each with its own secret. STRIPE_WEBHOOK_SECRET may be a single
    // value or comma-separated list ; we try each until one verifies.
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

    // Idempotency check — skip events we've already processed.
    const existing = await prisma.auditLog.findFirst({
      where: { action: "stripe.event.processed", meta: { path: ["eventId"], equals: event.id } },
      select: { logId: true },
    });
    if (existing) return res.json({ received: true, idempotent: true });

    try {
      await handleEvent(event);
      // Record success — both for idempotency AND for the audit-log
      // explorer admins use to debug "did this charge actually arrive?".
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
      // Unhandled processing error → 500 so Stripe retries (they back
      // off exponentially up to ~3 days).
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
    // payout.paid: Connect-account event ; we only audit, no DB write.
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

  // latest_charge is a string id ; we resolve the charge object only
  // when we need the receipt URL (skipped here — receipt lives in
  // Stripe dashboard for the demo).
  const chargeId = typeof pi.latest_charge === "string" ? pi.latest_charge : null;

  await prisma.order.update({
    where: { orderId },
    data: {
      status: "paid",
      stripeChargeId: chargeId,
      stripeAmountReceived: pi.amount_received,
    },
  });
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

  // Pick the most recent refund.id from the list ; full vs partial is
  // captured by `charge.amount_refunded`.
  const lastRefund = charge.refunds?.data[0];
  await prisma.order.update({
    where: { orderId: order.orderId },
    data: {
      stripeRefundId: lastRefund?.id ?? null,
      stripeAmountRefunded: charge.amount_refunded,
      // Mark the order refunded only when fully refunded — partial
      // refunds keep the order in `paid` so the seller still sees
      // it as fulfilled.
      status: charge.amount === charge.amount_refunded ? "refunded" : undefined,
    },
  });
}

async function onAccountUpdated(event: Stripe.Event) {
  const acct = event.data.object as Stripe.Account;
  // `acct.id` is the Connect account that changed. Resolve store.
  await prisma.store.updateMany({
    where: { stripeAccountId: acct.id },
    data: {
      stripePayoutsEnabled: Boolean(acct.payouts_enabled),
      stripeChargesEnabled: Boolean(acct.charges_enabled),
    },
  });
}

async function onPayoutPaid(_event: Stripe.Event) {
  // No-op for now — the seller-wallet UI fetches payout history live
  // from Stripe so we don't materialise it. Audit row will still be
  // written by the outer handler.
}

export default router;
