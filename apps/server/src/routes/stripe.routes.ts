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
    res.json(status);
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
    const [balance, payouts, charges] = await Promise.all([
      getStoreBalance(store.stripeAccountId),
      listStorePayouts(store.stripeAccountId, 10),
      listStoreCharges(store.stripeAccountId, 10),
    ]);
    // Trim Stripe responses down to what the UI needs.
    res.json({
      configured: true,
      onboarded: true,
      payoutsEnabled: store.stripePayoutsEnabled,
      chargesEnabled: store.stripeChargesEnabled,
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
    const store = await prisma.store.findUnique({
      where: { storeId: currentStore(req).storeId },
      select: { stripeAccountId: true, stripeChargesEnabled: true },
    });
    if (!store?.stripeAccountId || !store.stripeChargesEnabled) {
      throw new AppError(400, "NotOnboarded",
        "Finish Stripe Connect onboarding before requesting a payout.");
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
      // amountBaht optional; omit for full refund.
      const amountSatang = req.body?.amountBaht
        ? Math.round(Number(req.body.amountBaht) * 100)
        : undefined;

      const refund = await refundOrder(order.stripePaymentIntentId, sellerStripeAccountId, amountSatang);

      // Optimistic local update so the admin UI updates immediately.
      await prisma.order.update({
        where: { orderId },
        data: {
          stripeRefundId: refund.id,
          stripeAmountRefunded: refund.amount,
          status: refund.amount === order.stripeAmountReceived ? "refunded" : order.status,
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
