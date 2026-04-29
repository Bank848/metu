-- Phase 20.2 — seller withdrawal feature.
--
-- Two new tables + two enums:
--
-- 1. WithdrawalStatus enum: pending | paid | rejected.
-- 2. StoreTxType enum: earn / withdraw / withdraw_reverse / refund_clawback / adjustment.
--    (only `withdraw` and `withdraw_reverse` are written by Phase 20.2;
--     the rest are scaffolded for Phase 22 refund work.)
--
-- 3. withdrawal — admin-reviewed seller payout requests. Coin amount
--    deducted from store.coin_balance at REQUEST time so two
--    simultaneous withdraw requests can't double-spend a balance.
--    fee_percent_bp snapshots the global rate so changing the
--    setting later doesn't retroactively shift open requests.
--    paid_proof_image is base64 (text) — admin uploads bank-transfer
--    slip when marking a request paid (mirrors topup.slip_image).
--
-- 4. store_transaction — per-store ledger so the seller-wallet UI
--    can show a chronological history without merging derived rows
--    from order_item + withdrawal. Mirrors wallet_transaction shape
--    (amount, balance_after, reference, meta) but per Store rather
--    than per User. earn rows are NOT written by this migration —
--    they'll be backfilled in Phase 22 when the order-checkout
--    transaction also gets a StoreTransaction insert. For Phase 20.2
--    we only write `withdraw` and `withdraw_reverse` rows, which is
--    enough to power the seller-wallet "Recent activity" table.

CREATE TYPE "WithdrawalStatus" AS ENUM ('pending', 'paid', 'rejected');
CREATE TYPE "StoreTxType"      AS ENUM ('earn', 'withdraw', 'withdraw_reverse', 'refund_clawback', 'adjustment');

CREATE TABLE "withdrawal" (
  "withdrawal_id"      SERIAL              PRIMARY KEY,
  "store_id"           INTEGER             NOT NULL,
  "amount_coins"       INTEGER             NOT NULL,
  "fee_percent_bp"     INTEGER             NOT NULL,
  "fee_coins"          INTEGER             NOT NULL,
  "net_coins"          INTEGER             NOT NULL,
  "net_baht"           DECIMAL(10, 2)      NOT NULL,
  "bank_name"          VARCHAR(60)         NOT NULL,
  "bank_account_no"    VARCHAR(20)         NOT NULL,
  "bank_account_name"  VARCHAR(80)         NOT NULL,
  "status"             "WithdrawalStatus"  NOT NULL DEFAULT 'pending',
  "requested_at"       TIMESTAMP(3)        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewed_by"        INTEGER             NULL,
  "reviewed_at"        TIMESTAMP(3)        NULL,
  "paid_proof_image"   TEXT                NULL,
  "rejection_reason"   VARCHAR(200)        NULL,

  CONSTRAINT "withdrawal_store_fk"    FOREIGN KEY ("store_id")    REFERENCES "store"("store_id")    ON DELETE CASCADE,
  CONSTRAINT "withdrawal_reviewer_fk" FOREIGN KEY ("reviewed_by") REFERENCES "user"("user_id")     ON DELETE SET NULL,

  -- Defence in depth: amount_coins > 0 and fee_coins / net_coins
  -- compute consistently. Validated app-side too — keeping the SQL
  -- guard means a future REST surface that bypasses the service can't
  -- corrupt the ledger.
  CONSTRAINT "withdrawal_amount_positive"  CHECK ("amount_coins" > 0),
  CONSTRAINT "withdrawal_fee_nonneg"       CHECK ("fee_coins"    >= 0),
  CONSTRAINT "withdrawal_net_consistent"   CHECK ("net_coins"     = "amount_coins" - "fee_coins")
);

CREATE INDEX "withdrawal_store_requested_idx" ON "withdrawal"("store_id", "requested_at" DESC);
CREATE INDEX "withdrawal_status_requested_idx" ON "withdrawal"("status", "requested_at");

CREATE TABLE "store_transaction" (
  "store_tx_id"   SERIAL          PRIMARY KEY,
  "store_id"      INTEGER         NOT NULL,
  "type"          "StoreTxType"   NOT NULL,
  "amount"        INTEGER         NOT NULL,
  "balance_after" INTEGER         NOT NULL,
  "reference"     VARCHAR(80)     NULL,
  "meta"          JSONB           NULL,
  "created_at"    TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "store_transaction_store_fk" FOREIGN KEY ("store_id") REFERENCES "store"("store_id") ON DELETE CASCADE
);

CREATE INDEX "store_transaction_store_created_idx" ON "store_transaction"("store_id", "created_at" DESC);
