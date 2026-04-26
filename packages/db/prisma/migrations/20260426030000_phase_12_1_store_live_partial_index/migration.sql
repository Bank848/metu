-- Phase 12.1 / S8 proposal — partial index on the "live stores"
-- subset of the store table. Speeds up every query that filters
-- `WHERE deleted_at IS NULL` and orders by created_at DESC, which
-- covers /admin/stores, /admin/reports leaderboards, /, /health,
-- and the public store browse.
--
-- The existing full index `store_deleted_at_idx` is preserved for
-- moderation views that need to enumerate soft-deleted rows.
--
-- We skip CREATE INDEX CONCURRENTLY because Prisma migrations run
-- inside a transaction (CONCURRENTLY can't). At today's scale (~8
-- stores) the index builds instantly with no observable lock impact.
-- IF NOT EXISTS makes the migration safe to re-run during local
-- shadow-db comparisons.
CREATE INDEX IF NOT EXISTS "store_live_idx"
  ON "store" ("created_at" DESC)
  WHERE "deleted_at" IS NULL;
