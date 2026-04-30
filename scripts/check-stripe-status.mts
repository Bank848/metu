/**
 * Quick read-only check of Stripe Connect rollout status.
 */
import { readFileSync } from "node:fs";
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
process.env.DATABASE_URL = loadEnv(".supabase-credentials.local").DATABASE_URL ?? "";

const prisma = new PrismaClient();
const stores = await prisma.store.findMany({
  where: { deletedAt: null },
  select: {
    storeId: true, name: true,
    stripeAccountId: true,
    stripeChargesEnabled: true,
    stripePayoutsEnabled: true,
  },
  orderBy: { storeId: "asc" },
});

console.log("\n┌──────┬─────────────────────────┬───────────────────────────┬─────────┬─────────┐");
console.log("│ #    │ Store name              │ Stripe acct               │ charges │ payouts │");
console.log("├──────┼─────────────────────────┼───────────────────────────┼─────────┼─────────┤");
for (const s of stores) {
  const id = String(s.storeId).padEnd(4);
  const name = s.name.padEnd(23).slice(0, 23);
  const acct = (s.stripeAccountId ?? "(none)").padEnd(25);
  const charges = s.stripeChargesEnabled ? " ✓ on  " : " - off ";
  const payouts = s.stripePayoutsEnabled ? " ✓ on  " : " - off ";
  console.log(`│ ${id} │ ${name} │ ${acct} │${charges}│${payouts}│`);
}
console.log("└──────┴─────────────────────────┴───────────────────────────┴─────────┴─────────┘\n");
await prisma.$disconnect();
