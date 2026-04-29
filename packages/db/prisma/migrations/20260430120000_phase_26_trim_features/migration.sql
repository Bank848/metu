-- Phase 26 — trim unused features before CPE241 presentation.
--
-- Drops 8 tables and 4 enums that the demo will not exercise:
--   * Cut features:  Message, ProductQuestion, StockAlert
--   * Cut payment:   Wallet, WalletTransaction, Topup, Withdrawal,
--                    StoreTransaction (all replaced by Stripe Connect
--                    in Phase 27 — Stripe is the system of record for
--                    balance / refund / payout).
--
-- Also drops obsolete columns:
--   * SystemSetting.{chat_enabled, wallet_enabled, promptpay_id,
--                    withdrawal_fee_percent}
--   * ProductItem.coin_price        (no more coin pricing layer)
--   * Store.coin_balance            (Stripe balance is source of truth)
--
-- Backup: git tag pre-feature-trim-2026-04-30 + branch
--   archive/messages-qna-stockalert-promptpay (both pushed to origin).

-- 1. Drop 3 cut features
DROP TABLE IF EXISTS "stock_alert" CASCADE;
DROP TABLE IF EXISTS "product_question" CASCADE;
DROP TABLE IF EXISTS "message" CASCADE;

-- 2. Drop wallet / coin / payment-related tables.
--    Order matters: store_transaction + withdrawal reference store ;
--    wallet_transaction references wallet ; topup references users.
DROP TABLE IF EXISTS "store_transaction" CASCADE;
DROP TABLE IF EXISTS "withdrawal" CASCADE;
DROP TABLE IF EXISTS "topup" CASCADE;
DROP TABLE IF EXISTS "wallet_transaction" CASCADE;
DROP TABLE IF EXISTS "wallet" CASCADE;

-- 3. Drop SystemSetting columns no longer needed.
ALTER TABLE "system_setting"
    DROP COLUMN IF EXISTS "chat_enabled",
    DROP COLUMN IF EXISTS "wallet_enabled",
    DROP COLUMN IF EXISTS "promptpay_id",
    DROP COLUMN IF EXISTS "withdrawal_fee_percent";

-- 4. Drop coin pricing on ProductItem (no more coin layer).
ALTER TABLE "product_item" DROP COLUMN IF EXISTS "coin_price";

-- 5. Drop Store.coin_balance (Stripe Connect handles balance now).
ALTER TABLE "store" DROP COLUMN IF EXISTS "coin_balance";

-- 6. Drop ENUMs that no longer have referencing tables.
DROP TYPE IF EXISTS "WithdrawalStatus";
DROP TYPE IF EXISTS "StoreTxType";
DROP TYPE IF EXISTS "WalletTxType";
DROP TYPE IF EXISTS "TopupStatus";
