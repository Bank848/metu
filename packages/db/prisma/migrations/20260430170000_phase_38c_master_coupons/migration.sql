-- Phase 38C: support "Master Coupons" -- platform-wide promo codes that
-- apply to any cart line regardless of which store sold it. The doc
-- already promised this feature in Project Requirements 2.a but the
-- schema enforced NOT NULL on store_id, so master coupons could never
-- be created. This migration relaxes the constraint and adds a partial
-- unique index so multiple master coupons can't share the same code.
--
-- The existing per-store unique (store_id, code) keeps working for
-- store-scoped coupons because Postgres treats NULL as distinct in
-- the default unique index, so master coupons (NULL, "FOO") don't
-- conflict with store coupons (5, "FOO").
--
-- Per-user redemption is still bounded by the @@unique([couponId,
-- userId]) on coupon_usage added in Phase 38B. Master coupons that
-- want a global "first one wins" cap should set usage_limit=1 and the
-- application layer will reject redemption past that count.

ALTER TABLE "coupon" ALTER COLUMN "store_id" DROP NOT NULL;

-- Partial unique index: among rows where store_id IS NULL (master
-- coupons), code must be globally unique.
CREATE UNIQUE INDEX "coupon_master_code_unique"
  ON "coupon" ("code") WHERE "store_id" IS NULL;
