-- Phase 27 — Stripe Connect (test mode) integration columns.
--
-- Constraint from the plan: "อย่าเพิ่ม table ถ้าไม่จำเป็น" — so we add
-- *columns* to existing rows instead of creating Payment / StripeAccount
-- tables. Stripe is the system of record for payment / balance / payout
-- data ; we only persist the IDs we need to drive UI + webhooks.
--
-- Store: link to a Connect Express account + capability flags
-- Order : link to PaymentIntent / Charge / Refund + amount summary

ALTER TABLE "store"
    ADD COLUMN "stripe_account_id"      VARCHAR(40),
    ADD COLUMN "stripe_payouts_enabled" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "stripe_charges_enabled" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS "store_stripe_account_id_idx"
    ON "store" ("stripe_account_id");

ALTER TABLE "orders"
    ADD COLUMN "stripe_payment_intent_id" VARCHAR(40),
    ADD COLUMN "stripe_charge_id"         VARCHAR(40),
    ADD COLUMN "stripe_refund_id"         VARCHAR(40),
    ADD COLUMN "stripe_amount_received"   INT,
    ADD COLUMN "stripe_amount_refunded"   INT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS "order_stripe_pi_idx"
    ON "orders" ("stripe_payment_intent_id");
