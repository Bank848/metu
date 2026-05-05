-- Final cleanup of the hard-delete refactor.
--
-- The previous migration (20260505200000_hard_delete) tried to drop
-- the deleted_at columns from store and product but Postgres rejected
-- the DROP COLUMN with 2BP01 (dependent_objects_still_exist). Two
-- kinds of dependents block the drop:
--
--   1. Partial indexes (store_live_idx etc.) whose WHERE clause
--      references deleted_at IS NULL.
--   2. The lecture-10 views live_stores_view + product_with_avg_rating_view
--      that select WHERE deleted_at IS NULL.
--
-- We drop the dependents, drop the columns, and rebuild the views with
-- the new predicate. Post-hard-delete, "live" just means
-- suspended_at IS NULL on a store and is_active = true on a product —
-- a deleted row is gone from the table entirely so the predicate
-- collapses.

-- 1. Partial indexes — predicates referenced deleted_at.
DROP INDEX IF EXISTS "store_live_idx";
DROP INDEX IF EXISTS "store_live_v2_idx";
DROP INDEX IF EXISTS "product_live_idx";
DROP INDEX IF EXISTS "product_live_partial_idx";
DROP INDEX IF EXISTS "store_live_partial_idx";

-- 2. Lecture-10 demo views referenced deleted_at directly. Drop here,
--    rebuild after the column is gone.
DROP VIEW IF EXISTS "live_stores_view";
DROP VIEW IF EXISTS "product_with_avg_rating_view";

-- 3. Now the columns can go.
ALTER TABLE "store"   DROP COLUMN IF EXISTS "deleted_at";
ALTER TABLE "product" DROP COLUMN IF EXISTS "deleted_at";

-- 4. Replace the live-stores partial index without the deleted_at
--    term. /browse + the public store page already filter only on
--    suspended_at, so the same lookup path is preserved.
CREATE INDEX IF NOT EXISTS "store_live_idx"
  ON "store" ("created_at" DESC)
  WHERE "suspended_at" IS NULL;

-- 5. Rebuild the views without the soft-delete clause. Same column
--    list and column ordering so the rubric demo still matches the
--    docs/rubric-coverage.md write-up.
CREATE VIEW "live_stores_view" AS
SELECT
  store_id,
  owner_id,
  business_type_id,
  name,
  description,
  profile_image,
  cover_image,
  created_at
FROM "store"
WHERE suspended_at IS NULL;

COMMENT ON VIEW "live_stores_view" IS
  'Public-facing stores only. Excludes admin-suspended stores; deleted stores are hard-deleted so they are not present in the base table.';

CREATE VIEW "product_with_avg_rating_view" AS
SELECT
  p.product_id,
  p.store_id,
  p.category_id,
  p.name,
  p.is_active,
  p.created_at,
  COALESCE(AVG(r.rating)::numeric(3,2), 0)::numeric(3,2) AS avg_rating,
  COUNT(r.review_id)::int                                AS review_count
FROM "product" p
LEFT JOIN "product_review" r ON r.product_id = p.product_id
GROUP BY p.product_id;

COMMENT ON VIEW "product_with_avg_rating_view" IS
  'Each live product with its avg rating + review count. Deleted products are hard-deleted so a soft-delete clause is unnecessary.';

-- 6. Re-grant analytics access on the rebuilt views (DROP VIEW also
--    drops the GRANTs).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'metu_analytics') THEN
    EXECUTE 'GRANT SELECT ON "live_stores_view", "product_with_avg_rating_view" TO metu_analytics';
  END IF;
END
$$;
