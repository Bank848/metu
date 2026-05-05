-- ERD says Order is created from selected CartItems, not anchored to a
-- Cart row. Order.userId is already denormalised from cart.userId so no
-- buyer data is lost. Drop the FK + index + column on Order in one go.
ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "orders_cart_id_fkey";
DROP INDEX IF EXISTS "orders_cart_id_idx";
ALTER TABLE "orders" DROP COLUMN IF EXISTS "cart_id";
