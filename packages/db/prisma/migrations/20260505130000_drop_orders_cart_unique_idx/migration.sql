-- Previous attempt used DROP CONSTRAINT, but the original init migration
-- created a UNIQUE INDEX (not a constraint), so the drop was a no-op and
-- inserts into orders kept failing P2002 on cart_id. Drop the index here
-- and replace it with a plain non-unique index for cart→order lookups.
DROP INDEX IF EXISTS "orders_cart_id_key";
CREATE INDEX IF NOT EXISTS "orders_cart_id_idx" ON "orders"("cart_id");
