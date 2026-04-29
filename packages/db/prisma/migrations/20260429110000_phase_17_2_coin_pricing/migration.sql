-- Phase 17.2 — coin pricing migration.
--
-- Add an Int `coin_price` column to product_item alongside the
-- existing Decimal `price`. The coin price is the canonical
-- buyer-facing price after this migration; `price` (THB) stays
-- around for analytics, audit, and the admin top-up reviewer who
-- still needs to compare a baht slip to the original baht price.
--
-- Conversion: 1 baht = 10 coins (locked-in design decision).
-- We backfill via SQL ROUND(unit_price * 10) so existing seeded
-- products carry over with the same effective ratio.
--
-- Side effects on coupons: coupons store discount as a fixed
-- baht amount (`discount_amount`) OR a percent (`discount_percent`).
-- Phase 17.5+ will read these as coin amounts via × 10 at apply
-- time; we DON'T migrate coupon amounts in this batch because
-- the coupon table is small and humans (admins) can re-key them
-- later if confused. Discount-percent coupons are unaffected.
--
-- Adding NOT NULL with a DEFAULT in one ALTER lets Postgres skip
-- a full table rewrite (uses the in-place fast path).

ALTER TABLE "product_item"
  ADD COLUMN "coin_price" INTEGER NOT NULL DEFAULT 0;

UPDATE "product_item"
   SET "coin_price" = ROUND("price" * 10);

-- Ensure no row ever ends up at 0 coins (a free product is fine in
-- the demo, but a coin-priced product should be at least 1 coin to
-- avoid surprising "you paid 0 coins for an order" rows in the
-- ledger). The CHECK is non-zero-friendly to allow free downloads.
ALTER TABLE "product_item"
  ADD CONSTRAINT product_item_coin_price_nonneg CHECK ("coin_price" >= 0);
