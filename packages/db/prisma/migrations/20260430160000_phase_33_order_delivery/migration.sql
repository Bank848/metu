-- Phase 33: order delivery + Stripe Connect contact info
--
-- The schema now distinguishes the public preview link (sample_url, kept
-- as-is) from the post-purchase asset references (delivery_url +
-- license_key_template). At fulfillment time the order_item snapshots
-- delivered_url / delivered_key from the parent product_item so the
-- buyer's "what they paid for" never silently changes if the seller
-- edits the product later.
--
-- store gets contact_email + phone for the receipt email's
-- "contact this store" footer.

ALTER TABLE "product_item"
  ADD COLUMN "delivery_url" TEXT NULL,
  ADD COLUMN "license_key_template" VARCHAR(80) NULL;

ALTER TABLE "order_item"
  ADD COLUMN "delivered_url" TEXT NULL,
  ADD COLUMN "delivered_key" VARCHAR(80) NULL,
  ADD COLUMN "delivered_at" TIMESTAMP(3) NULL;

ALTER TABLE "store"
  ADD COLUMN "contact_email" VARCHAR(120) NULL,
  ADD COLUMN "phone" VARCHAR(20) NULL;
