#!/usr/bin/env node
// Cross-platform build wrapper for `@metu/web`.
//
// On Vercel (where DATABASE_URL is injected into the build environment) this
// runs `prisma migrate deploy` against Neon before the Next.js build, so any
// pending migrations land on the live database before the new code starts
// serving requests. Locally — where DATABASE_URL may not be configured for
// the web workspace — we silently skip the migrate step so type-checking /
// `next build` still succeeds.
//
// Neon specifics: migrations must run against the *direct* (non-pooled)
// endpoint because pgbouncer on the pooled endpoint strips features Prisma
// Migrate needs (advisory locks, prepared statements). We prefer
// `DATABASE_URL_UNPOOLED` when present and fall back to `DATABASE_URL`.
import { execSync } from "node:child_process";

const stripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
if (
  stripePublishableKey &&
  (stripePublishableKey.includes("placeholder") ||
    stripePublishableKey.includes("build-") ||
    !stripePublishableKey.startsWith("pk_"))
) {
  throw new Error(
    "[build] NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not a real Stripe publishable key. " +
      "Deploy with scripts/deploy-web.ps1 or scripts/deploy-web.sh so the key is passed as a build arg.",
  );
}

const migrateUrl = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
const hasDb = Boolean(migrateUrl);

// Phase 50 — `prisma migrate deploy` failure used to be swallowed,
// which let production deploys ship with an out-of-date schema (the
// new code then crashed at runtime when it touched a missing column
// or table). The new policy:
//
//   - If `ALLOW_MIGRATION_FAILURE=true` is set explicitly, the script
//     warns and continues (developer escape hatch for local builds
//     where a malformed migration shouldn't block `next build`).
//   - Otherwise, a migration error throws and the build aborts — the
//     Fly release_command then fails the deploy, leaving the previous
//     version serving instead of putting code into prod against the
//     wrong schema.
const allowMigrationFailure = process.env.ALLOW_MIGRATION_FAILURE === "true";

if (hasDb) {
  try {
    execSync(
      "prisma migrate deploy --schema=../../packages/db/prisma/schema.prisma",
      {
        stdio: "inherit",
        // Point Prisma at the direct URL for migrations only. Runtime
        // traffic still uses the regular DATABASE_URL (pooled) via
        // lib/server/prisma.ts.
        env: { ...process.env, DATABASE_URL: migrateUrl },
      },
    );
  } catch (err) {
    if (allowMigrationFailure) {
      console.warn(
        "[build] prisma migrate deploy failed — continuing because " +
          "ALLOW_MIGRATION_FAILURE=true. Verify DATABASE_URL(_UNPOOLED) " +
          "is correct and the migration file is well-formed.",
      );
    } else {
      console.error(
        "[build] prisma migrate deploy failed — aborting build. " +
          "Set ALLOW_MIGRATION_FAILURE=true if you want to bypass this " +
          "(local dev only — never in CI/prod).",
      );
      throw err;
    }
  }
} else {
  console.log("[build] DATABASE_URL not set — skipping prisma migrate deploy");
}

execSync("next build", { stdio: "inherit" });
