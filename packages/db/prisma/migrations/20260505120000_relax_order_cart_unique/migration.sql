-- Drop the UNIQUE(cart_id) constraint on the orders table.
--
-- Originally the schema enforced one-order-per-cart so the cart-swap at
-- checkout would always mint a fresh cart. With the new flow that keeps
-- the buyer's cart alive across a Stripe back-button (and cancels stale
-- pending orders on retry), a cart can legitimately be referenced by
-- both a cancelled pending order AND the next pending order. Replace
-- the unique with a plain index — we still want fast cart→order lookups,
-- just not the uniqueness check that was blocking retries with P2002.
ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "orders_cart_id_key";
CREATE INDEX IF NOT EXISTS "orders_cart_id_idx" ON "orders"("cart_id");
