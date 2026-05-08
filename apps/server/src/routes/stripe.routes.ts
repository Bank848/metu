// Stripe Connect routes. All endpoints 503 when Stripe is not configured.
import { Router } from "express";
import { requireAuth, currentAuth } from "../middleware/auth.js";
import { requireStore, currentStore } from "../middleware/seller.js";
import { requireRecent2FA } from "../middleware/require-recent-2fa.js";
import { AppError } from "../utils/errors.js";
import { audit } from "../utils/audit.js";
import { prisma } from "../db/prisma.js";
import {
  isConfigured,
  createOnboardingLink,
  refreshAccountStatus,
  getStoreBalance,
  listStorePayouts,
  listStoreCharges,
  refundOrder,
  createManualPayout,
  listPlatformActivity,
  getPlatformBalance,
} from "../services/stripe.service.js";

const sellerRouter = Router();

sellerRouter.post("/stripe/onboard", requireAuth(), requireStore(), async (req, res, next) => {
  try {
    if (!isConfigured()) {
      return res.status(503).json({ error: "StripeNotConfigured" });
    }
    const storeId = currentStore(req).storeId;
    const url = await createOnboardingLink(storeId);
    await audit({
      actorId: currentAuth(req)!.uid,
      action: "stripe.connect.onboard_link",
      targetType: "store",
      targetId: storeId,
      req,
    });
    res.json({ url });
  } catch (err) {
    next(err);
  }
});

sellerRouter.get("/stripe/status", requireAuth(), requireStore(), async (req, res, next) => {
  try {
    if (!isConfigured()) {
      return res.status(503).json({ error: "StripeNotConfigured" });
    }
    const status = await refreshAccountStatus(currentStore(req).storeId);
    // page reads `status.configured` to decide whether to
    // render the "Stripe not configured" warning. We were returning
    // only the account flags so `configured` resolved to undefined →
    // falsy → page mistakenly told sellers Stripe wasn't set up at
    // all even though the secret was deployed.
    res.json({ configured: true, ...status });
  } catch (err) {
    next(err);
  }
});

sellerRouter.get("/wallet", requireAuth(), requireStore(), async (req, res, next) => {
  try {
    if (!isConfigured()) {
      return res.json({
        configured: false,
        message: "Stripe is not configured. Set STRIPE_SECRET_KEY to enable the seller wallet.",
      });
    }
    const store = await prisma.store.findUnique({
      where: { storeId: currentStore(req).storeId },
      select: { stripeAccountId: true, stripePayoutsEnabled: true, stripeChargesEnabled: true },
    });
    if (!store?.stripeAccountId) {
      return res.json({
        configured: true,
        onboarded: false,
        message: "Connect a Stripe account to start accepting payments.",
      });
    }
    const [balance, payouts, charges, status] = await Promise.all([
      getStoreBalance(store.stripeAccountId),
      listStorePayouts(store.stripeAccountId, 10),
      listStoreCharges(store.stripeAccountId, 10),
      // Refresh capabilities + requirements so the page can tell the
      // seller exactly which fields Stripe still wants if charges are
      // restricted. Updates our local boolean cache as a side effect.
      refreshAccountStatus(currentStore(req).storeId),
    ]);
    res.json({
      configured: true,
      onboarded: true,
      payoutsEnabled: status.payoutsEnabled,
      chargesEnabled: status.chargesEnabled,
      requirements: status.requirements,
      balance: {
        available: balance.available.map((b) => ({ amount: b.amount, currency: b.currency })),
        pending:   balance.pending.map((b)   => ({ amount: b.amount, currency: b.currency })),
      },
      payouts: payouts.data.map((p) => ({
        id: p.id, amount: p.amount, currency: p.currency,
        status: p.status, arrivalDate: p.arrival_date, created: p.created,
      })),
      charges: charges.data.map((c) => ({
        id: c.id, amount: c.amount, currency: c.currency,
        status: c.status, created: c.created,
      })),
    });
  } catch (err) {
    next(err);
  }
});

// Manual payout trigger. Stripe rejects (400) if amount > available balance.
sellerRouter.post("/stripe/payout", requireAuth(), requireStore(), async (req, res, next) => {
  try {
    if (!isConfigured()) {
      return res.status(503).json({ error: "StripeNotConfigured" });
    }
    // Stripe can grant charges_enabled without payouts_enabled (e.g.
    // when bank verification is pending). Gate the payout endpoint on
    // payouts_enabled, not charges_enabled, so a seller who can collect
    // money but can't yet receive a transfer gets a clear error.
    const store = await prisma.store.findUnique({
      where: { storeId: currentStore(req).storeId },
      select: { stripeAccountId: true, stripePayoutsEnabled: true },
    });
    if (!store?.stripeAccountId || !store.stripePayoutsEnabled) {
      throw new AppError(400, "PayoutsDisabled",
        "Stripe payouts aren't enabled on your store yet — finish onboarding (bank account + verification) first.");
    }
    // Body: { amountBaht: number } - require explicit amount.
    const amountBaht = Number(req.body?.amountBaht);
    if (!Number.isFinite(amountBaht) || amountBaht <= 0) {
      throw new AppError(400, "InvalidAmount", "amountBaht must be a positive number.");
    }
    const payout = await createManualPayout(
      store.stripeAccountId,
      Math.round(amountBaht * 100),
    );
    await audit({
      actorId: currentAuth(req)!.uid,
      action: "stripe.payout.manual",
      targetType: "store",
      targetId: currentStore(req).storeId,
      meta: { payoutId: payout.id, amountSatang: payout.amount } as never,
      req,
    });
    res.json({ ok: true, payoutId: payout.id, amount: payout.amount, status: payout.status });
  } catch (err) {
    next(err);
  }
});

const adminRouter = Router();

// Platform-wide Stripe activity feed — read-only, admin-only.
// Returns the latest events across the platform Connect account so the
// admin overview can show charges/refunds/payouts in real time.
adminRouter.get("/stripe/activity", requireAuth(["admin"]), async (_req, res, next) => {
  try {
    if (!isConfigured()) {
      return res.status(503).json({ error: "StripeNotConfigured" });
    }
    const [events, balance] = await Promise.all([
      listPlatformActivity(20),
      getPlatformBalance(),
    ]);
    res.json({
      balance: {
        available: balance.available.map((b) => ({ amount: b.amount, currency: b.currency })),
        pending: balance.pending.map((b) => ({ amount: b.amount, currency: b.currency })),
      },
      events: events.data.map((e) => {
        // Strip massive expansion fields; keep what the UI needs.
        const obj = e.data.object as { id?: string; amount?: number; amount_received?: number; currency?: string; status?: string };
        return {
          id: e.id,
          type: e.type,
          created: e.created,
          objectId: obj.id ?? null,
          amount: obj.amount ?? obj.amount_received ?? null,
          currency: obj.currency ?? null,
          status: obj.status ?? null,
        };
      }),
    });
  } catch (err) {
    next(err);
  }
});

adminRouter.post(
  "/orders/:id/refund",
  requireAuth(["admin"]),
  requireRecent2FA(15),
  async (req, res, next) => {
    try {
      if (!isConfigured()) {
        return res.status(503).json({ error: "StripeNotConfigured" });
      }
      const orderId = Number(req.params.id);
      if (!Number.isFinite(orderId)) {
        throw new AppError(400, "InvalidId");
      }
      // Resolve the seller's Stripe account via order -> item -> product -> store.
      const order = await prisma.order.findUnique({
        where: { orderId },
        include: {
          items: {
            take: 1,
            include: { productItem: { include: { product: { include: { store: true } } } } },
          },
        },
      });
      if (!order) throw new AppError(404, "OrderNotFound");
      if (!order.stripePaymentIntentId) {
        throw new AppError(400, "NotStripeCharged",
          "This order was placed in demo mode (no Stripe charge). Mark it refunded manually instead.");
      }
      const sellerStripeAccountId =
        order.items[0]?.productItem?.product?.store?.stripeAccountId;
      if (!sellerStripeAccountId) {
        throw new AppError(400, "MissingStripeAccount",
          "Could not resolve the seller's Stripe Connect account for this order.");
      }
      // amountBaht optional; omit for full refund. Earlier rev did
      // `Math.round(Number(body.amountBaht) * 100)` with no NaN /
      // negative guard — `Number("abc")` is NaN, `Number("-5")` is
      // -5, both reached Stripe and returned a 500 with the raw
      // Stripe error in the response body. Validate before the call.
      let amountSatang: number | undefined;
      if (req.body?.amountBaht !== undefined && req.body?.amountBaht !== null && req.body?.amountBaht !== "") {
        const baht = Number(req.body.amountBaht);
        if (!Number.isFinite(baht) || baht <= 0) {
          throw new AppError(400, "InvalidAmount", "Refund amount must be a positive number.");
        }
        amountSatang = Math.round(baht * 100);
        // Cap at the captured amount so a typo can't request more
        // than was paid (Stripe rejects but we want the friendly 400).
        if (order.stripeAmountReceived && amountSatang > order.stripeAmountReceived) {
          throw new AppError(
            400,
            "RefundExceedsCapture",
            `Refund (${amountSatang} satang) exceeds the captured amount (${order.stripeAmountReceived} satang).`,
          );
        }
      }

      const refund = await refundOrder(order.stripePaymentIntentId, sellerStripeAccountId, amountSatang);

      // Optimistic local update so the admin UI updates immediately.
      // CRITICAL: track CUMULATIVE refunded amount across multiple
      // partial refunds. Earlier rev wrote `refund.amount` (just THIS
      // refund) which obliterated prior partials and broke the
      // status-flip comparison. Use the existing value + this refund
      // as the source of truth; the webhook (`onChargeRefunded`)
      // re-syncs from `charge.amount_refunded` shortly after, but
      // until then the optimistic write must agree with reality.
      const cumulative = (order.stripeAmountRefunded ?? 0) + refund.amount;
      const fullyRefunded =
        order.stripeAmountReceived != null && cumulative >= order.stripeAmountReceived;
      await prisma.order.update({
        where: { orderId },
        data: {
          stripeRefundId: refund.id,
          stripeAmountRefunded: cumulative,
          status: fullyRefunded ? "refunded" : order.status,
        },
      });

      await audit({
        actorId: currentAuth(req)!.uid,
        action: "stripe.refund",
        targetType: "order",
        targetId: orderId,
        meta: { refundId: refund.id, amountSatang: refund.amount } as never,
        req,
      });

      res.json({ ok: true, refund: { id: refund.id, amount: refund.amount } });
    } catch (err) {
      next(err);
    }
  },
);

export { sellerRouter as stripeSellerRouter, adminRouter as stripeAdminRouter };
