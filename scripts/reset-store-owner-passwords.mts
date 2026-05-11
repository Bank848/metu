/**
 * Reset passwords for the 4 themed-store owners (KMUTT BOOK STORE,
 * Ado Official Music Shop, Shonen Jump, Macrohard) to a temporary
 * value so the operator can log in and finish Stripe Connect
 * onboarding. Mirrors the new password into better-auth's Account row
 * so signInEmail accepts it.
 *
 * Outputs credentials to stdout — owner email + username + the temp
 * password. Sets `require_password_reset = true` so the owner is
 * prompted to set a real password on first login.
 *
 * Run locally:
 *
 *   tsx scripts/reset-store-owner-passwords.mts          # default temp pw
 *   tsx scripts/reset-store-owner-passwords.mts MyTemp!  # custom temp pw
 */
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

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

const TARGET_STORES = [
  "KMUTT BOOK STORE",
  "Ado Official Music Shop",
  "Shonen Jump",
  "Macrohard",
];

const TEMP_PW = process.argv[2] ?? "Metu-temp-2026!";

async function main() {
  const prisma = new PrismaClient();
  const hash = await bcrypt.hash(TEMP_PW, 10);

  const stores = await prisma.store.findMany({
    where: { name: { in: TARGET_STORES } },
    select: {
      storeId: true,
      name: true,
      owner: { select: { userId: true, email: true, username: true } },
    },
  });
  if (stores.length === 0) {
    console.error("⚠ No matching stores found.");
    process.exit(1);
  }

  console.log("\n┌─ Temp password ─────────────────────────────────");
  console.log(`│  ${TEMP_PW}`);
  console.log("│  (require_password_reset=true — set a real one after login)");
  console.log("└──────────────────────────────────────────────────\n");

  for (const s of stores) {
    if (!s.owner) {
      console.warn(`⚠ ${s.name} has no owner record, skipping.`);
      continue;
    }
    await prisma.user.update({
      where: { userId: s.owner.userId },
      data: { password: hash, requirePasswordReset: true },
    });
    // Mirror to better-auth credential account so signInEmail accepts
    // the new hash. We sync EVERY credential row for this user (not
    // just providerId+accountId=current_email) because owners whose
    // emails were changed in the past have a stale Account row keyed
    // by the previous email — and better-auth's signInEmail can pick
    // either row when multiple match the user, which on the legacy
    // row would re-reject the new password.
    const updatedExisting = await prisma.account.updateMany({
      where: { userId: s.owner.userId, providerId: "credential" },
      data: { password: hash },
    });
    if (updatedExisting.count === 0) {
      // No credential row at all (e.g. Google-only signup) — create one.
      await prisma.account.create({
        data: {
          userId: s.owner.userId,
          accountId: s.owner.email,
          providerId: "credential",
          password: hash,
        },
      });
    }
    console.log(
      `✓ ${s.name.padEnd(28)}  ${s.owner.email.padEnd(38)}  @${s.owner.username}`,
    );
  }
  console.log("\nDone. Owners must log in then set a new password from /profile/edit.");
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
