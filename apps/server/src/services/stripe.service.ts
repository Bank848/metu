/**
 * Phase 27 — Stripe Connect (test mode) integration.
 *
 * Stripe is the system of record for payment / balance / refund /
 * payout state. We persist only the IDs we need to drive UI +
 * webhooks ; no Wallet, Topup, or Withdrawal tables anymore.
 *
 * The whole module is `isConfigured()`-guarded so a deploy without
 * STRIPE_SECRET_KEY still boots — checkout falls back to "demo
 * mode" (Order created in `paid` status without a Stripe charge),
 * the seller-onboarding page renders an instructional state, and
 * the webhook endpoint returns 503.
 *
 * Test mode is the default mental model for this project — Stripe
 * Thailand can't be put into live mode without a registered Thai
 * business + ภพ.20 + bank verification, none of which a CPE241
 * group has access to. Test mode is free, unlimited, and exposes
 * the full Connect / refund / payout API surface.
 */
import Stripe from "stripe";
import { prisma } from "../db/prisma.js";
import { AppError } from "../utils/errors.js";

// One singleton per process. Module-level so `getClient()` is cheap.
let _client: Stripe | null = null;

/** Return `true` when STRIPE_SECRET_KEY is set in the environment. */
export function isConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

/** Return the singleton client, throwing if Stripe is not configured. */
export function getClient(): Stripe {
  if (!isConfigured()) {
    throw new AppError(
      503,
      "StripeNotConfigured",
      "STRIPE_SECRET_KEY is not set on the server. Set it via flyctl secrets to enable Stripe-backed payments.",
    );
  }
  if (!_client) {
    _client = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      // Tag the integration so logs in the Stripe dashboard read
      // "metu/0.1.0" instead of "stripe-node/x.y.z". apiVersion is
      // intentionally omitted so we pin to the SDK's bundled default —
      // bumping the SDK is the explicit signal to test webhooks
      // against any payload-schema changes.
      appInfo: { name: "metu", version: "0.1.0" },
    });
  }
  return _client;
}

// ─────────────────────────────────────────────────────────────────
// Stripe Connect (Express accounts)
// ─────────────────────────────────────────────────────────────────

/**
 * Create a Stripe Connect Express account for a seller. Idempotent —
 * if the store already has `stripeAccountId`, return the existing one.
 *
 * `country: "TH"` so the account onboards into the Thai capability
 * matrix. Express accounts get Stripe-hosted onboarding (KYC, bank
 * info, identity docs) — we don't have to build that UI.
 */
export async function createConnectAccount(storeId: number): Promise<string> {
  const stripe = getClient();
  const store = await prisma.store.findUnique({ where: { storeId } });
  if (!store) throw new AppError(404, "StoreNotFound");
  if (store.stripeAccountId) return store.stripeAccountId;

  const acct = await stripe.accounts.create({
    type: "express",
    country: "TH",
    email: undefined, // collected by Stripe-hosted onboarding
    capabilities: {
      card_payments: { requested: true },
      transfers:     { requested: true },
    },
    business_profile: {
      name: store.name,
      product_description: store.description,
    },
    metadata: { storeId: String(storeId) },
  });

  await prisma.store.update({
    where: { storeId },
    data: { stripeAccountId: acct.id },
  });
  return acct.id;
}

/**
 * Generate a single-use onboarding link. The seller clicks it, fills in
 * Stripe-hosted forms, then gets bounced back to our return URL.
 */
export async function createOnboardingLink(storeId: number): Promise<string> {
  const stripe = getClient();
  const accountId = await createConnectAccount(storeId);
  const baseUrl = process.env.STRIPE_CONNECT_RETURN_BASE
    ?? process.env.NEXT_PUBLIC_SITE_URL
    ?? "http://localhost:3000";

  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${baseUrl}/seller/onboarding/refresh`,
    return_url:  `${baseUrl}/seller/onboarding/return`,
    type: "account_onboarding",
  });
  return link.url;
}

/** Pull the latest capability flags from Stripe + persist locally. */
export async function refreshAccountStatus(storeId: number) {
  const stripe = getClient();
  const store = await prisma.store.findUnique({ where: { storeId } });
  if (!store?.stripeAccountId) {
    return { stripeAccountId: null, payoutsEnabled: false, chargesEnabled: false };
  }
  const acct = await stripe.accounts.retrieve(store.stripeAccountId);
  const payoutsEnabled = Boolean(acct.payouts_enabled);
  const chargesEnabled = Boolean(acct.charges_enabled);

  await prisma.store.update({
    where: { storeId },
    data: { stripePayoutsEnabled: payoutsEnabled, stripeChargesEnabled: chargesEnabled },
  });
  return { stripeAccountId: store.stripeAccountId, payoutsEnabled, chargesEnabled };
}

// ─────────────────────────────────────────────────────────────────
// Checkout — direct charge with destination payout
// ─────────────────────────────────────────────────────────────────

/**
 * Create a PaymentIntent for an order. Direct-charge model: the buyer
 * pays through *our* Stripe account, then `transfer_data.destination`
 * pushes the funds (minus the application fee) to the seller's Connect
 * account at capture time.
 *
 * Single-store orders only — multi-store carts split into separate
 * intents (Stripe Connect doesn't natively support N-way splits in
 * one charge). The current cart model already groups by checkout, so
 * this is a future feature, not a Phase 27 problem.
 *
 * Returns `{ paymentIntentId, clientSecret }`. The frontend uses
 * `clientSecret` with `<PaymentElement />` to confirm the payment ;
 * the eventual webhook bumps Order.status to `paid`.
 */
export async function createPaymentIntent(opts: {
  orderId: number;
  amountBaht: number;
  sellerStripeAccountId: string;
  applicationFeePercent: number; // 0-100
  buyerEmail?: string;
}): Promise<{ paymentIntentId: string; clientSecret: string }> {
  const stripe = getClient();
  // Stripe stores money in the smallest currency unit — for THB
  // that's satang (1 baht = 100 satang).
  const amountSatang = Math.round(opts.amountBaht * 100);
  const applicationFeeSatang = Math.floor(
    (amountSatang * opts.applicationFeePercent) / 100,
  );

  const intent = await stripe.paymentIntents.create({
    amount: amountSatang,
    currency: "thb",
    automatic_payment_methods: { enabled: true },
    application_fee_amount: applicationFeeSatang,
    transfer_data: { destination: opts.sellerStripeAccountId },
    receipt_email: opts.buyerEmail,
    metadata: { orderId: String(opts.orderId) },
  });

  return {
    paymentIntentId: intent.id,
    clientSecret: intent.client_secret ?? "",
  };
}

// ─────────────────────────────────────────────────────────────────
// Refund
// ─────────────────────────────────────────────────────────────────

/**
 * Refund a Stripe-charged order. `reverse_transfer: true` claws back
 * the corresponding Connect transfer, and `refund_application_fee`
 * also returns the platform's fee — full refund is full refund.
 */
export async function refundOrder(
  paymentIntentId: string,
  amountSatang?: number,
): Promise<Stripe.Refund> {
  const stripe = getClient();
  return stripe.refunds.create({
    payment_intent: paymentIntentId,
    amount: amountSatang, // omit for full refund
    reverse_transfer: true,
    refund_application_fee: true,
    metadata: { source: "metu_admin" },
  });
}

// ─────────────────────────────────────────────────────────────────
// Reads — `/seller/wallet` proxies these to render the dashboard
// without ever materialising balance / transactions in our DB.
// ─────────────────────────────────────────────────────────────────

export async function getStoreBalance(stripeAccountId: string) {
  const stripe = getClient();
  // `balance.retrieve` doesn't accept params in v22 SDK — the
  // Connect-account scoping is via the second `RequestOptions` arg.
  const balance = await stripe.balance.retrieve(undefined, { stripeAccount: stripeAccountId });
  return balance;
}

export async function listStorePayouts(stripeAccountId: string, limit = 20) {
  const stripe = getClient();
  return stripe.payouts.list({ limit }, { stripeAccount: stripeAccountId });
}

export async function listStoreCharges(stripeAccountId: string, limit = 20) {
  const stripe = getClient();
  return stripe.charges.list({ limit }, { stripeAccount: stripeAccountId });
}
