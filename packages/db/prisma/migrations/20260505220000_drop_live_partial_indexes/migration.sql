-- Final cleanup of the hard-delete refactor.
--
-- The previous migration (20260505200000_hard_delete) tried to drop
-- the deleted_at columns from store and product but Postgres rejected
-- the DROP COLUMN with 2BP01 (dependent_objects_still_exist). The
-- partial indexes from earlier phases referenced WHERE deleted_at IS
-- NULL in their predicates, so the columns couldn't go away until we
-- dropped the indexes first.
--
-- This migration drops the partial indexes (we no longer soft-delete,
-- so a "live stores" predicate just becomes "suspended_at IS NULL")
-- and then removes the leftover columns. IF EXISTS keeps it idempotent
-- in case the prod DB was already partially cleaned via SSH.

DROP INDEX IF EXISTS "store_live_idx";
DROP INDEX IF EXISTS "store_live_v2_idx";
DROP INDEX IF EXISTS "product_live_idx";
DROP INDEX IF EXISTS "product_live_partial_idx";
DROP INDEX IF EXISTS "store_live_partial_idx";

ALTER TABLE "store"   DROP COLUMN IF EXISTS "deleted_at";
ALTER TABLE "product" DROP COLUMN IF EXISTS "deleted_at";

-- Replace the live-stores partial index without the deleted_at term.
-- /browse + the public store page already filter only on suspended_at,
-- so this still serves the same lookup with a smaller predicate.
CREATE INDEX IF NOT EXISTS "store_live_idx"
  ON "store" ("created_at" DESC)
  WHERE "suspended_at" IS NULL;
