/**
 * One-shot backfill — for every fulfilled OrderItem where
 * deliveryMethod IN (license_key, email) AND quantity > 1 AND
 * deliveredKey currently holds only one line, generate (quantity - 1)
 * extra keys and append them so the buyer ends up with one key per
 * unit they paid for. Mirrors the fix in finalizeOrder() which now
 * generates qty keys at delivery time — this script is only needed
 * for orders that were finalised before that fix landed.
 *
 * Idempotent: skips items that already have `quantity` newline-
 * separated keys in deliveredKey.
 *
 * Run locally:
 *   tsx scripts/backfill-license-keys.mts            # dry-run by default
 *   tsx scripts/backfill-license-keys.mts --commit   # apply updates
 */
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import crypto from "node:crypto";

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

const COMMIT = process.argv.includes("--commit");

function generateLicenseKey(template: string | null): string {
  if (!template) return crypto.randomUUID();
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  return template.replace(/X{4}/g, () => {
    let block = "";
    for (let i = 0; i < 4; i++) {
      block += alphabet[crypto.randomInt(0, alphabet.length)];
    }
    return block;
  });
}

async function main() {
  const prisma = new PrismaClient();

  const rows = await prisma.orderItem.findMany({
    where: {
      deliveredAt: { not: null },
      deliveredKey: { not: null },
      quantity: { gt: 1 },
      productItem: {
        deliveryMethod: { in: ["license_key", "email"] },
      },
    },
    include: {
      productItem: {
        select: { deliveryMethod: true, licenseKeyTemplate: true },
      },
      order: { select: { orderId: true } },
    },
  });

  let touched = 0;
  for (const it of rows) {
    if (!it.deliveredKey || !it.productItem) continue;
    const existing = it.deliveredKey.split("\n").map((k) => k.trim()).filter(Boolean);
    const need = Math.max(0, it.quantity - existing.length);
    if (need <= 0) continue;

    const extras: string[] = [];
    for (let i = 0; i < need; i++) {
      extras.push(generateLicenseKey(it.productItem.licenseKeyTemplate));
    }
    const merged = [...existing, ...extras].join("\n");

    console.log(
      `order #${it.order.orderId} · item #${it.orderItemId} · qty=${it.quantity} · had=${existing.length} · adding=${need}`,
    );

    if (COMMIT) {
      await prisma.orderItem.update({
        where: { orderItemId: it.orderItemId },
        data: { deliveredKey: merged },
      });
    }
    touched++;
  }

  console.log(
    `\n${touched} order item(s) ${COMMIT ? "updated" : "would be updated (dry-run; pass --commit to apply)"}.`,
  );
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
