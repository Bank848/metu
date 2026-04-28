-- Phase 16.1 — store suspended_at column.
--
-- The intermediate state between "live" and "soft-deleted":
-- a suspended store is HIDDEN from public surfaces (browse,
-- product/[id]'s store sidecard, sitemap) but the store row
-- itself, its products, and order history all stay intact. The
-- seller still sees it in /seller dashboard with a banner
-- explaining the situation. Admin can lift the suspension at any
-- time without losing data.
--
-- Distinct from deleted_at:
--   • deletedAt set  → store is GONE (admin removal). Reversible
--                       only by clearing the column manually.
--   • suspendedAt set → store is FROZEN. Admin toggles via the UI.
--   • both NULL      → store is LIVE.
--
-- Public queries filter both predicates; seller dashboard sees
-- everything but renders the banner conditionally.
ALTER TABLE "store"
  ADD COLUMN "suspended_at" TIMESTAMP(3);

-- Partial index supporting the common "live stores" predicate.
-- Mirrors the Phase 12.1 store_live_idx pattern but adds the new
-- suspended_at column to the WHERE clause so /browse + /store
-- queries hit it cleanly.
CREATE INDEX "store_live_v2_idx"
  ON "store"("created_at" DESC)
  WHERE "deleted_at" IS NULL AND "suspended_at" IS NULL;
