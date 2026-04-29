-- Phase 16.3 — Mode A swap, login fix.
--
-- Better-auth's `user` schema declares both `createdAt` and `updatedAt`
-- as REQUIRED fields. Its Prisma adapter generates a `select` clause
-- that includes both on every findUserByEmail / findUserById call. Our
-- legacy `users` table only has `created_date` (no `updated_at` at
-- all), so Prisma throws "Unknown argument" and the adapter silently
-- returns an incomplete user with `accounts: []` — which the sign-in
-- flow then rejects with the misleading "Credential account not found"
-- error.
--
-- Fix:
--   1. Add `updated_at` column. Backfill to `created_date` on existing
--      rows so the field is non-null from the get-go.
--   2. lib/auth.ts maps better-auth's `createdAt` to our existing
--      `created_date` column (companion change in this commit).
--
-- The Prisma `@updatedAt` decorator manages writes from app code; this
-- migration just gets the column into the schema.

ALTER TABLE "users"
  ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "users"
   SET "updated_at" = COALESCE("created_date", CURRENT_TIMESTAMP);
