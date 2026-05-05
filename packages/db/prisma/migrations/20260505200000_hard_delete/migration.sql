-- Hard-delete refactor. Soft-delete columns go away; deletes are real
-- DELETE statements. Order history survives via OrderItem snapshots +
-- ON DELETE SET NULL on OrderItem.product_item_id.

-- 1. Order item snapshots so a hard-deleted product doesn't blank the
--    receipt. Backfill from the live join, then make snapshot non-null.
ALTER TABLE "order_item"
  ADD COLUMN IF NOT EXISTS "product_name_snapshot"  VARCHAR(120),
  ADD COLUMN IF NOT EXISTS "product_image_snapshot" TEXT;

UPDATE "order_item" oi
   SET "product_name_snapshot" = p."name",
       "product_image_snapshot" = (
         SELECT pi2."product_image" FROM "product_image" pi2
          WHERE pi2."product_id" = p."product_id"
          ORDER BY pi2."sort_order" ASC LIMIT 1
       )
  FROM "product_item" pi
  JOIN "product" p ON p."product_id" = pi."product_id"
 WHERE oi."product_item_id" = pi."product_item_id"
   AND oi."product_name_snapshot" IS NULL;

UPDATE "order_item" SET "product_name_snapshot" = '(deleted product)' WHERE "product_name_snapshot" IS NULL;
ALTER TABLE "order_item" ALTER COLUMN "product_name_snapshot" SET NOT NULL;
ALTER TABLE "order_item" ALTER COLUMN "product_name_snapshot" SET DEFAULT '(deleted product)';

-- 2. Make product_item_id nullable + flip FK to ON DELETE SET NULL.
ALTER TABLE "order_item" ALTER COLUMN "product_item_id" DROP NOT NULL;
ALTER TABLE "order_item" DROP CONSTRAINT IF EXISTS "order_item_product_item_id_fkey";
ALTER TABLE "order_item"
  ADD CONSTRAINT "order_item_product_item_id_fkey"
  FOREIGN KEY ("product_item_id") REFERENCES "product_item"("product_item_id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- 3. Same for coupon — should null out, not block deletion.
ALTER TABLE "order_item" DROP CONSTRAINT IF EXISTS "order_item_coupon_id_fkey";
ALTER TABLE "order_item"
  ADD CONSTRAINT "order_item_coupon_id_fkey"
  FOREIGN KEY ("coupon_id") REFERENCES "coupon"("coupon_id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- 4. Drop deleted_at columns + indexes from soft-deleted tables.
DROP INDEX IF EXISTS "users_deleted_at_idx";
DROP INDEX IF EXISTS "store_deleted_at_idx";
DROP INDEX IF EXISTS "product_deleted_at_idx";
ALTER TABLE "users"   DROP COLUMN IF EXISTS "deleted_at";
ALTER TABLE "store"   DROP COLUMN IF EXISTS "deleted_at";
ALTER TABLE "product" DROP COLUMN IF EXISTS "deleted_at";
