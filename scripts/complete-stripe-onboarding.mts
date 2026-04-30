/**
 * Phase 32 — Patch every API-fillable requirement on the seeded
 * sandbox accounts so the hosted onboarding has nothing left to ask.
 * Anything Stripe still demands afterwards (proof_of_liveness, the
 * tos checkbox) gets surfaced as a one-click hosted URL.
 */
import { readFileSync } from "node:fs";
import Stripe from "stripe";
import { PrismaClient } from "@prisma/client";

function loadEnv(path: string) {
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
process.env.DATABASE_URL = supabaseEnv.DATABASE_URL ?? "";

const stripe = new Stripe(stripeEnv.STRIPE_SECRET_KEY);
const prisma = new PrismaClient();

const stores = await prisma.store.findMany({
  where: { stripeAccountId: { not: null }, stripeChargesEnabled: false, deletedAt: null },
  include: { owner: { select: { firstName: true, lastName: true, email: true } } },
  orderBy: { storeId: "asc" },
});

console.log(`\nPatching ${stores.length} accounts\n`);

for (const s of stores) {
  if (!s.stripeAccountId) continue;
  console.log(`-> ${s.name} (${s.stripeAccountId})`);

  try {
    await stripe.accounts.update(s.stripeAccountId, {
      business_profile: {
        support_phone: "+66812345678",
      },
      individual: {
        nationality: "TH",
        id_number_secondary: "1234567890123",
        registered_address: {
          line1: "address_full_match",
          city: "Bangkok",
          state: "Bangkok",
          postal_code: "10110",
          country: "TH",
        },
        relationship: {
          title: "Owner",
        },
      },
      tos_acceptance: {
        date: Math.floor(Date.now() / 1000),
        ip: "127.0.0.1",
        service_agreement: "recipient",
      },
    } as any);
    console.log(`   patched OK`);
  } catch (err) {
    console.log(`   patch error: ${(err as Error).message}`);
  }

  // Re-check what's still due.
  const acct = await stripe.accounts.retrieve(s.stripeAccountId);
  const due = acct.requirements?.currently_due ?? [];
  console.log(`   still due: ${due.length ? due.join(", ") : "(none)"}`);
  console.log(`   charges_enabled=${acct.charges_enabled}`);

  // Sync flags to DB.
  await prisma.store.update({
    where: { storeId: s.storeId },
    data: {
      stripeChargesEnabled: Boolean(acct.charges_enabled),
      stripePayoutsEnabled: Boolean(acct.payouts_enabled),
    },
  });

  if (!acct.charges_enabled) {
    const link = await stripe.accountLinks.create({
      account: s.stripeAccountId,
      refresh_url: "https://metu.fly.dev/seller/onboarding",
      return_url: "https://metu.fly.dev/seller/onboarding/return",
      type: "account_onboarding",
    });
    console.log(`   ONBOARDING URL: ${link.url}`);
  }
  console.log("");
}

await prisma.$disconnect();
