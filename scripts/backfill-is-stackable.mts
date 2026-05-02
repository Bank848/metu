/**
 * Phase 48 — backfill `product.is_stackable` based on the variant's
 * delivery method.
 *
 *   download / streaming / email  →  is_stackable = false  (single copy)
 *   license_key                   →  is_stackable = true   (resellable)
 *
 * Idempotent — re-running just re-asserts the rule.
 *
 * Run locally: tsx scripts/backfill-is-stackable.mts
 */
import { readFileSync } from "node:fs";
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

const supabaseEnv = loadEnv(".supabase-credentials.local");
process.env.DATABASE_URL =
  supabaseEnv.DATABASE_URL ?? supabaseEnv.DATABASE_URL_UNPOOLED ?? "";
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL not in .supabase-credentials.local");
}

const prisma = new PrismaClient();

async function main() {
  // Single SQL — Postgres handles the boolean expression directly.
  const result = await prisma.$executeRawUnsafe(
    `UPDATE product SET is_stackable = (delivery_method = 'license_key')`,
  );
  console.log(`✓ Backfilled is_stackable on ${result} product rows`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
