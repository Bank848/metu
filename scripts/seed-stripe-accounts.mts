/**
 * Phase 32 — Auto-provision Stripe Connect (Custom) accounts for every
 * seed store that doesn't have one yet.
 *
 * Why Custom and not Express? Express requires the seller to click
 * through Stripe's hosted onboarding for tos_acceptance. We have ~10
 * seed stores and the user doesn't want to do that 10 times. Custom
 * accounts let the platform set tos_acceptance + individual data +
 * external bank account directly via the API in one shot.
 *
 * In sandbox mode, three magic values trigger instant verification:
 *   • address.line1 = "address_full_match" → address verifies
 *   • dob = 1901-01-01 → identity verifies
 *   • id_number = any 13-digit Thai ID → ID number passes
 *
 * Bank account uses Stripe's TH test routing — sandbox accepts any
 * 12-digit account number.
 *
 * Run: tsx scripts/seed-stripe-accounts.mts
 */
import { readFileSync } from "node:fs";
import Stripe from "stripe";
import { PrismaClient } from "@prisma/client";

function loadEnv(path: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (line.startsWith("#") || !line.trim()) continue;
    const m = line.match(/^([A-Z_]+)=(.+)$/);
    if (m) env[m[1]] = m[2].trim();
  }
  return env;
}

const stripeEnv = loadEnv(".stripe-credentials.local");
const supabaseEnv = loadEnv(".supabase-credentials.local");
// Prefer pooler (port 6543) — Supabase free-tier blocks direct
// connections from outside Fly's egress IPs. Pooler accepts
// connections from anywhere and handles transactions fine for our
// row-by-row updates.
process.env.DATABASE_URL = supabaseEnv.DATABASE_URL ?? supabaseEnv.DATABASE_URL_UNPOOLED ?? "";

if (!stripeEnv.STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY not in .stripe-credentials.local");
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL not in .supabase-credentials.local");

const stripe = new Stripe(stripeEnv.STRIPE_SECRET_KEY);
const prisma = new PrismaClient();

const stores = await prisma.store.findMany({
  where: { stripeAccountId: null, deletedAt: null },
  include: {
    owner: {
      select: { userId: true, email: true, firstName: true, lastName: true },
    },
  },
  orderBy: { storeId: "asc" },
});

console.log(`\nFound ${stores.length} stores needing Stripe accounts:\n`);
for (const s of stores) {
  console.log(`  - Store ${s.storeId}: ${s.name} (owner ${s.owner.firstName} ${s.owner.lastName})`);
}
console.log("");

let success = 0;
let failed = 0;

for (const s of stores) {
  try {
    console.log(`-> Store ${s.storeId} (${s.name})...`);

    // 1) Create a TH bank account token (test routing).
    // Thailand bank account requires routing_number (3-digit bank code).
    // "999" is Stripe's test bank code that always passes validation in
    // sandbox mode. Real values: 002 (Bangkok Bank), 014 (SCB), 004 (KBank).
    const bankToken = await stripe.tokens.create({
      bank_account: {
        country: "TH",
        currency: "thb",
        routing_number: "999",
        account_number: "000123456789",
        account_holder_name: `${s.owner.firstName} ${s.owner.lastName}`,
        account_holder_type: "individual",
      },
    });

    // 2) Create Express account with everything pre-filled inline.
    // TH compliance forces Stripe to be loss-liable + requirement
    // collector — that means an Express hosted onboarding URL is the
    // only way to capture tos_acceptance. We pre-fill everything else
    // (individual, business_profile, bank) so the seller only sees
    // a "Review & confirm" page with one click.
    const acct = await stripe.accounts.create({
      country: "TH",
      email: s.owner.email,
      business_type: "individual",
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      controller: {
        losses: { payments: "stripe" },
        fees: { payer: "application" },
        stripe_dashboard: { type: "none" },
        requirement_collection: "stripe",
      },
      business_profile: {
        mcc: "5734",
        product_description: `${s.name} - digital marketplace seller on METU`,
        url: "https://metu.fly.dev",
      },
      individual: {
        first_name: s.owner.firstName,
        last_name: s.owner.lastName,
        email: s.owner.email,
        phone: "+66812345678",
        dob: { day: 1, month: 1, year: 1901 },
        address: {
          line1: "address_full_match",
          city: "Bangkok",
          state: "Bangkok",
          postal_code: "10110",
          country: "TH",
        },
        id_number: "1234567890123",
      },
      external_account: bankToken.id,
      metadata: {
        metu_store_id: String(s.storeId),
        metu_owner_user_id: String(s.owner.userId),
      },
    });

    console.log(`   created ${acct.id}`);
    console.log(`   charges_enabled=${acct.charges_enabled} payouts_enabled=${acct.payouts_enabled}`);

    // 3) Generate a one-shot account link → seller opens, sees the
    // pre-filled review page, clicks Submit → tos_acceptance captured.
    const link = await stripe.accountLinks.create({
      account: acct.id,
      refresh_url: "https://metu.fly.dev/seller/onboarding",
      return_url: "https://metu.fly.dev/seller/onboarding/return",
      type: "account_onboarding",
    });
    console.log(`   onboarding URL: ${link.url}`);

    await prisma.store.update({
      where: { storeId: s.storeId },
      data: {
        stripeAccountId: acct.id,
        stripeChargesEnabled: Boolean(acct.charges_enabled),
        stripePayoutsEnabled: Boolean(acct.payouts_enabled),
      },
    });
    success++;
  } catch (err) {
    console.error(`   FAILED: ${(err as Error).message}`);
    failed++;
  }
  console.log("");
}

console.log(`\nDone. Success: ${success}, Failed: ${failed}\n`);
await prisma.$disconnect();
