-- Collapse store_stats into the parent store row per ERD. Only `rating`
-- survives; ctr + response_time were never wired into UX and aren't in
-- the project requirements doc.
ALTER TABLE "store" ADD COLUMN IF NOT EXISTS "rating" INT NOT NULL DEFAULT 0;

-- Backfill rating from the existing store_stats row (if any).
UPDATE "store" s
   SET "rating" = ss."rating"
  FROM "store_stats" ss
 WHERE ss."store_id" = s."store_id";

DROP TABLE IF EXISTS "store_stats" CASCADE;
