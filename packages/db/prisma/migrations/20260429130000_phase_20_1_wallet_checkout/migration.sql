-- Phase 20.1 — wire the wallet ledger into checkout.
--
-- Adds three columns:
--   1. store.coin_balance — accumulated unwithdrawn coin earnings
--      per store. Updated atomically inside the checkout transaction:
--      buyer's wallet is debited, each store's coin_balance is
--      credited with (line_subtotal × (1 - platform_fee_percent / 100)).
--      Phase 20.2 (Withdrawal model) will decrement this when sellers
--      request a payout.
--
--   2. system_setting.platform_fee_percent — % the platform keeps
--      from every store-line subtotal at credit time. Default 5.00
--      means sellers earn 95% of each sale. Decimal(5,2) so admins
--      can set fractional percents (e.g. 5.5%). NOT stored on the
--      Order row — applied at credit time, derivable from the
--      coin_balance delta + the order's coinPrice subtotal.
--
--   3. system_setting.withdrawal_fee_percent — % deducted from a
--      withdrawal request's `amountCoins` to cover platform payout
--      cost. Default 0 (we eat the cost initially). Phase 20.2
--      snapshots this onto the Withdrawal row at request time so
--      changing the global setting later doesn't retroactively change
--      open requests.
--
-- All three default-backfill cleanly — no manual data migration.

ALTER TABLE "store"
  ADD COLUMN "coin_balance" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "system_setting"
  ADD COLUMN "platform_fee_percent"   DECIMAL(5, 2) NOT NULL DEFAULT 5.00,
  ADD COLUMN "withdrawal_fee_percent" DECIMAL(5, 2) NOT NULL DEFAULT 0.00;

-- Defence in depth: store.coin_balance must never go negative without
-- an explicit refund/clawback path (Phase 22 will add the refund
-- service). Until then, any code that decrements coin_balance below
-- zero will fail loudly at the SQL layer instead of silently rolling
-- a seller into permanent debt.
ALTER TABLE "store"
  ADD CONSTRAINT "store_coin_balance_nonnegative" CHECK ("coin_balance" >= 0);
