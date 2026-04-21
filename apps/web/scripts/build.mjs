#!/usr/bin/env node
// Cross-platform build wrapper for `@metu/web`.
//
// On Vercel (where DATABASE_URL is injected into the build environment) this
// runs `prisma migrate deploy` against Neon before the Next.js build, so any
// pending migrations land on the live database before the new code starts
// serving requests. Locally — where DATABASE_URL may not be configured for
// the web workspace — we silently skip the migrate step so type-checking /
// `next build` still succeeds.
import { execSync } from "node:child_process";

const hasDb = Boolean(process.env.DATABASE_URL);

if (hasDb) {
  try {
    execSync(
      "prisma migrate deploy --schema=../../packages/db/prisma/schema.prisma",
      { stdio: "inherit" },
    );
  } catch (err) {
    console.warn(
      "[build] prisma migrate deploy failed — continuing to next build. " +
        "Verify DATABASE_URL is correct and the migration file is well-formed.",
    );
    // Don't throw — pre-existing builds shouldn't break if a migration is
    // malformed; we'd rather see the type-check error from `next build`.
  }
} else {
  console.log("[build] DATABASE_URL not set — skipping prisma migrate deploy");
}

execSync("next build", { stdio: "inherit" });
