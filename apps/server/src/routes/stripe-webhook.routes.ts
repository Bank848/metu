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

    // Idempotency: a previous version of this handler did
    // findFirst → handleEvent → create as separate steps, which left a
    // TOCTOU window — two concurrent Stripe retries for the same
    // event.id (e.g. our first response was slow, Stripe re-fired)
    // could both pass the existence check and both run handleEvent,
    // double-finalising an order or double-refunding a charge.
    //
    // Fix: serialise per-event with a Postgres advisory transaction
    // lock keyed on a 32-bit hash of event.id, then re-check existence
    // inside the same transaction. The lock auto-releases on commit /
    // rollback so there's no leak if handleEvent throws. We don't need
    // a unique index migration on auditLog.meta — the lock alone
    // serialises the check + write for any given event.id, and the
    // two-phase (findFirst → create) becomes safe as long as both
    // calls share the locked transaction.
    try {
      const result = await prisma.$transaction(async (tx) => {
        // Lock key derived from event.id (FNV-1a 32-bit). Any 32-bit
        // signed integer works for pg_advisory_xact_lock(int).
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
        // Webhook handlers can take a few seconds (especially refund
        // processing). Bump the default 5s timeout so the lock-holding
        // transaction doesn't get killed mid-handler.
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

  // defence-in-depth: confirm the amount Stripe collected
  // matches the order total we recorded at checkout. If they diverge,
  // something tampered with the PI between create and confirm — flag
  // for manual review instead of auto-finalising.
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
  // Cancelled / refunded orders must NOT be flipped back to paid by a
  // late PI succeed. Earlier rev only short-circuited paid|fulfilled,
  // so a buyer who created order O1, backed out, called checkout
  // again (cancelUserPendingOrders flipped O1 to cancelled + restored
  // stock), and then had Stripe finally succeed PI₁ async would see
  // O1 resurrected — license keys minted, receipt sent, inventory off.
  // Audit + bail on any non-pending status.
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
  // Mirror createPaymentIntent's buyer-favourable floor (see
  // stripe.service.ts header). PI was charged at floor; expected here
  // must match or the amount_mismatch audit fires on legitimate orders.
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

  // Bump Transaction.date to payment-success time so the admin Recent
  // Transactions widget sorts paid orders ahead of stale checkouts.
  // Idempotent: re-stamping `now()` on a Stripe retry is harmless.
  // Transaction <-> Order is many-to-one via Order.transactionId, so
  // filter via the relation rather than a non-existent orderId column.
  await prisma.transaction.updateMany({
    where: {
      transactionType: "purchase",
      orders: { some: { orderId } },
    },
    data: { date: new Date() },
  });

  // Now that the charge is real, drop the purchased items from whatever
  // active cart the buyer carried forward. Cart row itself stays open
  // for any unrelated items still in it.
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
  // Cancel the order AND restore any non-digital stock it held, in one tx.
  // Without the stock restore, every failed PromptPay attempt would burn
  // inventory on a real-goods listing.
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
      // We use stripeRefundId presence as the "in-app refund already
      // wrote a negative-payout Transaction" sentinel — see below.
      stripeRefundId: true,
      status: true,
    },
  });
  if (!order) return;

  const lastRefund = charge.refunds?.data[0];
  const fullyRefunded = charge.amount === charge.amount_refunded;
  // Detect a refund that originated outside our app (e.g. Stripe
  // Dashboard, support reversal). The in-app paths
  // (seller.refundOrder + admin.refundTransaction) write a
  // negative-payout Transaction synchronously AND set
  // order.stripeRefundId before the webhook fires; if we don't see
  // that sentinel and the order isn't already flagged refunded,
  // this webhook is the first signal — book the ledger entry here so
  // the admin transactions widget stays consistent.
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
    // Refunds book as a negative `payout` row to mirror the in-app
    // flow (see admin.service.ts:refundTransaction +
    // seller.service.ts:refundOrder). Same shape so the admin widget
    // can't tell the difference between the two refund origins.
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

/**
 * FNV-1a 32-bit hash. Used to derive a stable advisory-lock key from a
 * Stripe event.id. Postgres `pg_advisory_xact_lock(int)` takes a
 * 32-bit signed int, so we mask down to that range. Returning a
 * positive int is fine — Postgres treats both signs as distinct slots.
 *
 * Why FNV-1a and not crypto.createHash: we don't need cryptographic
 * properties, just a fast, deterministic, well-distributed 32-bit
 * digest. The whole call runs in microseconds and stays in the same
 * Node process — no extra round-trip.
 */
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
