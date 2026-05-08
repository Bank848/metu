// Stripe Connect (test mode) integration. Stripe owns the payment
// state; we persist only the IDs we need. Module is isConfigured()
// guarded so a deploy without STRIPE_SECRET_KEY still boots in demo mode.
//
// Money-direction policy (buyer-favourable):
//   - Buyer charge:  Math.floor(baht * 100)  — sub-satang lost to buyer's favour
//   - Buyer refund:  Math.round(baht * 100)  — buyer gets the cent back
//   - Seller payout: Stripe owns the math; we never compute it locally
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
  // Buyer charge: floor satang so any sub-satang fragment lost is in
  // the buyer's favour (they pay slightly less, never slightly more
  // than what we displayed).
  const amountSatang = Math.floor(opts.amountBaht * 100);
  const applicationFeeSatang = Math.floor(
    (amountSatang * opts.applicationFeePercent) / 100,
  );

  const intent = await stripe.paymentIntents.create(
    {
      amount: amountSatang,
      currency: "thb",
      // Explicit card-only allowlist. `automatic_payment_methods` with
      // `allow_redirects: never` was supposed to hide redirect methods
      // like PromptPay but Stripe kept showing PromptPay anyway — be
      // explicit. PromptPay etc. settle async via
      // `payment_intent.processing` which our webhook does not handle,
      // so orders would sit pending forever.
      payment_method_types: ["card"],
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
 * Platform-wide Stripe activity feed for the admin overview. METU runs
 * Stripe Connect with direct charges, so charge / refund / payout /
 * transfer events fire on the seller's connected account, NOT on the
 * platform — a plain `events.list({})` call comes back empty for any
 * marketplace activity. Fan out across every store with a connected
 * account, merge by `created` DESC, and cache for 60s so admin
 * page-refreshes don't hammer Stripe.
 */
const ACTIVITY_TTL_MS = 60_000;
const _activityCache = new Map<
  string,
  { fetchedAt: number; events: Stripe.Event[] }
>();

export async function listPlatformActivity(
  limit = 20,
): Promise<{ data: Stripe.Event[] }> {
  const stripe = getClient();
  const now = Date.now();
  const cached = _activityCache.get("platform-activity");
  if (cached && now - cached.fetchedAt < ACTIVITY_TTL_MS) {
    return { data: cached.events.slice(0, limit) };
  }

  const types = [
    "charge.succeeded",
    "charge.refunded",
    "charge.failed",
    "payment_intent.succeeded",
    "payment_intent.payment_failed",
    "refund.created",
    "refund.updated",
    "payout.paid",
    "payout.failed",
    "transfer.created",
  ];

  const stores = await prisma.store.findMany({
    where: { stripeAccountId: { not: null } },
    select: { stripeAccountId: true },
  });

  const eventsByAccount = await Promise.allSettled(
    stores.map((s) =>
      stripe.events.list(
        { limit: 5, types },
        { stripeAccount: s.stripeAccountId! },
      ),
    ),
  );

  const merged: Stripe.Event[] = [];
  for (const r of eventsByAccount) {
    if (r.status === "fulfilled") merged.push(...r.value.data);
  }

  // Newest first.
  merged.sort((a, b) => b.created - a.created);
  const trimmed = merged.slice(0, Math.max(limit, 20));
  _activityCache.set("platform-activity", { fetchedAt: now, events: trimmed });
  return { data: trimmed.slice(0, limit) };
}

/** Platform-account balance (admin overview headline). */
export async function getPlatformBalance() {
  const stripe = getClient();
  return stripe.balance.retrieve();
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
