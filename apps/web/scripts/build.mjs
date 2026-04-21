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

const migrateUrl = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
const hasDb = Boolean(migrateUrl);

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
    console.warn(
      "[build] prisma migrate deploy failed — continuing to next build. " +
        "Verify DATABASE_URL(_UNPOOLED) is correct and the migration file is well-formed.",
    );
    // Don't throw — pre-existing builds shouldn't break if a migration is
    // malformed; we'd rather see the type-check error from `next build`.
  }
} else {
  console.log("[build] DATABASE_URL not set — skipping prisma migrate deploy");
}

execSync("next build", { stdio: "inherit" });
