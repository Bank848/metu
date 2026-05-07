// Stripe Connect (test mode) integration. Stripe owns the payment
// state; we persist only the IDs we need. Module is isConfigured()
// guarded so a deploy without STRIPE_SECRET_KEY still boots in demo mode.
import Stripe from "stripe";
import { prisma } from "../db/prisma.js";
import { AppError } from "../utils/errors.js";

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
      appInfo: { name: "metu", version: "0.1.0" },
    });
  }
  return _client;
}

/**
 * Create a Stripe Connect account for a seller. Idempotent: returns
 * the existing stripeAccountId if the store already has one.
 */
export async function createConnectAccount(storeId: number): Promise<string> {
  const stripe = getClient();
  const store = await prisma.store.findUnique({ where: { storeId } });
  if (!store) throw new AppError(404, "StoreNotFound");
  if (store.stripeAccountId) return store.stripeAccountId;

  // TH compliance: explicit `controller` shape so Stripe is loss-
  // liable and runs the hosted onboarding flow. `type:"express"`
  // isn't allowed in Thailand.
  const acct = await stripe.accounts.create({
    country: "TH",
    email: undefined,
    capabilities: {
      card_payments: { requested: true },
      transfers:     { requested: true },
    },
    controller: {
      losses: { payments: "stripe" },
      fees: { payer: "application" },
      stripe_dashboard: { type: "none" },
      requirement_collection: "stripe",
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

// Single-use onboarding link returned to the seller.
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

/**
 * Pull the latest capability flags + requirements from Stripe and
 * persist the boolean flags locally. Stripe also tells us *why* an
 * account can't make charges (currentlyDue + disabledReason) — we
 * surface those so the seller wallet UI can show actionable next
 * steps instead of a vague "cannot make charges" toast.
 */
export async function refreshAccountStatus(storeId: number) {
  const stripe = getClient();
  const store = await prisma.store.findUnique({ where: { storeId } });
  if (!store?.stripeAccountId) {
    return {
      stripeAccountId: null,
      payoutsEnabled: false,
      chargesEnabled: false,
      requirements: null,
    };
  }
  const acct = await stripe.accounts.retrieve(store.stripeAccountId);
  const payoutsEnabled = Boolean(acct.payouts_enabled);
  const chargesEnabled = Boolean(acct.charges_enabled);

  await prisma.store.update({
    where: { storeId },
    data: { stripePayoutsEnabled: payoutsEnabled, stripeChargesEnabled: chargesEnabled },
  });

  // Pull the actionable bits from the requirements object so the UI
  // can tell the seller exactly which fields Stripe still wants.
  const req = acct.requirements ?? {};
  const requirements = {
    disabledReason: (req as { disabled_reason?: string | null }).disabled_reason ?? null,
    currentlyDue: (req as { currently_due?: string[] }).currently_due ?? [],
    eventuallyDue: (req as { eventually_due?: string[] }).eventually_due ?? [],
    pastDue: (req as { past_due?: string[] }).past_due ?? [],
    cardPaymentsActive:
      (acct.capabilities as { card_payments?: string } | undefined)?.card_payments === "active",
    transfersActive:
      (acct.capabilities as { transfers?: string } | undefined)?.transfers === "active",
  };

  return {
    stripeAccountId: store.stripeAccountId,
    payoutsEnabled,
    chargesEnabled,
    requirements,
  };
}

/**
 * Create a PaymentIntent on the seller's connected account
 * (direct-charge model; destination-charge isn't available in TH).
 * Platform takes a cut via application_fee_amount.
 * Single-store orders only.
 */
export async function createPaymentIntent(opts: {
  orderId: number;
  amountBaht: number;
  sellerStripeAccountId: string;
  applicationFeePercent: number; // 0-100
  buyerEmail?: string;
}): Promise<{ paymentIntentId: string; clientSecret: string }> {
  const stripe = getClient();
  const amountSatang = Math.round(opts.amountBaht * 100);
  const applicationFeeSatang = Math.floor(
    (amountSatang * opts.applicationFeePercent) / 100,
  );

  const intent = await stripe.paymentIntents.create(
    {
      amount: amountSatang,
      currency: "thb",
      // Card only — async / redirect-based methods (PromptPay, FPX, etc.)
      // settle via the bank's app and arrive as `payment_intent.processing`,
      // which our webhook does not flip to paid (orders sit pending forever).
      // Restricting to non-redirect methods keeps the success → /orders
      // flip synchronous and instant.
      automatic_payment_methods: { enabled: true, allow_redirects: "never" },
      application_fee_amount: applicationFeeSatang,
      receipt_email: opts.buyerEmail,
      metadata: { orderId: String(opts.orderId) },
    },
    // Routes the create to the connected account.
    { stripeAccount: opts.sellerStripeAccountId },
  );

  return {
    paymentIntentId: intent.id,
    clientSecret: intent.client_secret ?? "",
  };
}

/**
 * Refund a Stripe-charged order. Direct-charge model: the refund
 * runs on the seller's account; refund_application_fee returns ours.
 */
export async function refundOrder(
  paymentIntentId: string,
  sellerStripeAccountId: string,
  amountSatang?: number,
): Promise<Stripe.Refund> {
  const stripe = getClient();
  return stripe.refunds.create(
    {
      payment_intent: paymentIntentId,
      amount: amountSatang, // omit for full refund
      refund_application_fee: true,
      metadata: { source: "metu_admin" },
    },
    { stripeAccount: sellerStripeAccountId },
  );
}

// /seller/wallet proxies these so we never persist balance ourselves.

export async function getStoreBalance(stripeAccountId: string) {
  const stripe = getClient();
  // v22 SDK: scope via the RequestOptions arg, not params.
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

/**
 * Trigger a manual payout to the seller's bank. Stripe rejects (400)
 * when amount > available balance.
 */
export async function createManualPayout(
  stripeAccountId: string,
  amountSatang: number,
): Promise<Stripe.Payout> {
  const stripe = getClient();
  return stripe.payouts.create(
    { amount: amountSatang, currency: "thb" },
    { stripeAccount: stripeAccountId },
  );
}
