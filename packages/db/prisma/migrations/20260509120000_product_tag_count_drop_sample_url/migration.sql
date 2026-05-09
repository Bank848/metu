-- Add ProductTag.tag_count + drop ProductItem.sample_url to match the
-- post-PR schema. tag_count starts at zero; backfill from product_n_tag
-- counts so existing tags ship with the right number rather than 0.

ALTER TABLE "product_tag"
  ADD COLUMN "tag_count" INTEGER NOT NULL DEFAULT 0;

UPDATE "product_tag" pt
   SET "tag_count" = sub.cnt
  FROM (
    SELECT tag_id, COUNT(*)::int AS cnt
      FROM "product_n_tag"
     GROUP BY tag_id
  ) sub
 WHERE pt."tag_id" = sub.tag_id;

ALTER TABLE "product_item" DROP COLUMN IF EXISTS "sample_url";
