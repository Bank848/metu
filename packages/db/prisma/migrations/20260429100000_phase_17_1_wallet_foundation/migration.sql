-- Phase 17.1 — Foundation tables for the wallet/coin economy.
--
-- Three new tables + one enum:
--   • system_setting     — single-row config for runtime feature
--                          flags (walletEnabled, chatEnabled) and
--                          the demo PromptPay ID for QR generation.
--                          Single row enforced by id=1 hard PK +
--                          a CHECK constraint.
--   • wallet             — one row per user, holds the current
--                          coin balance. Updated atomically inside
--                          wallet.service.{credit,debit}.
--   • wallet_transaction — append-only audit log of every coin
--                          movement (topup, spend, refund, grant).
--                          balance_after lets a UI render the
--                          ledger without a window-function query.
--   • topup              — one row per top-up attempt. Holds the
--                          generated PromptPay payload + (when
--                          submitted) the slip image + extracted
--                          QR data + admin-review state.
--
-- All three new transaction-y tables FK back to users with
-- ON DELETE CASCADE so a soft-delete-then-purge of a user takes
-- their wallet history with them.

-- ─────────────────────────────────────────────────────────────────
-- 1. system_setting (single-row config)
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE "system_setting" (
  "id"             INTEGER PRIMARY KEY DEFAULT 1,
  "wallet_enabled" BOOLEAN NOT NULL DEFAULT false,
  "chat_enabled"   BOOLEAN NOT NULL DEFAULT true,
  "promptpay_id"   VARCHAR(20) NOT NULL DEFAULT '0812345678',
  "updated_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT system_setting_singleton CHECK ("id" = 1)
);

INSERT INTO "system_setting" ("id") VALUES (1);

-- ─────────────────────────────────────────────────────────────────
-- 2. wallet (one row per user, on demand)
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE "wallet" (
  "wallet_id" SERIAL PRIMARY KEY,
  "user_id"   INTEGER NOT NULL UNIQUE,
  "balance"   INTEGER NOT NULL DEFAULT 0,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT wallet_balance_nonneg CHECK ("balance" >= 0),
  CONSTRAINT wallet_user_fk
    FOREIGN KEY ("user_id") REFERENCES "users" ("user_id")
    ON DELETE CASCADE
);

-- ─────────────────────────────────────────────────────────────────
-- 3. wallet_transaction (append-only audit ledger)
-- ─────────────────────────────────────────────────────────────────
CREATE TYPE "WalletTxType" AS ENUM ('topup', 'spend', 'refund', 'grant');

CREATE TABLE "wallet_transaction" (
  "wallet_tx_id"  SERIAL PRIMARY KEY,
  "user_id"       INTEGER NOT NULL,
  "type"          "WalletTxType" NOT NULL,
  "amount"        INTEGER NOT NULL,        -- signed: +credit / -debit
  "balance_after" INTEGER NOT NULL,
  "reference"     VARCHAR(80),             -- e.g. "order:42", "topup:9"
  "meta"          JSONB,
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT wallet_tx_balance_after_nonneg CHECK ("balance_after" >= 0),
  CONSTRAINT wallet_tx_user_fk
    FOREIGN KEY ("user_id") REFERENCES "users" ("user_id")
    ON DELETE CASCADE
);

CREATE INDEX "wallet_transaction_user_id_idx" ON "wallet_transaction" ("user_id");
CREATE INDEX "wallet_transaction_created_at_idx" ON "wallet_transaction" ("created_at" DESC);

-- ─────────────────────────────────────────────────────────────────
-- 4. topup (PromptPay top-up requests + slip review state)
-- ─────────────────────────────────────────────────────────────────
CREATE TYPE "TopupStatus" AS ENUM ('pending', 'paid', 'rejected', 'expired');

CREATE TABLE "topup" (
  "topup_id"           SERIAL PRIMARY KEY,
  "user_id"            INTEGER NOT NULL,
  "amount_baht"        INTEGER NOT NULL,
  "coins_expected"     INTEGER NOT NULL,
  "status"             "TopupStatus" NOT NULL DEFAULT 'pending',
  "promptpay_payload"  TEXT NOT NULL,
  "slip_image"         TEXT,                 -- base64 data URL when uploaded
  "slip_reference"     VARCHAR(80) UNIQUE,   -- extracted from slip QR; UNIQUE = no duplicate slips
  "slip_qr_payload"    TEXT,                 -- raw EMVCo QR string for audit
  "reviewed_by"        INTEGER,
  "reviewed_at"        TIMESTAMP(3),
  "rejection_reason"   VARCHAR(200),
  "created_at"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT topup_amount_positive CHECK ("amount_baht" > 0),
  CONSTRAINT topup_coins_positive  CHECK ("coins_expected" > 0),
  CONSTRAINT topup_user_fk
    FOREIGN KEY ("user_id") REFERENCES "users" ("user_id")
    ON DELETE CASCADE,
  CONSTRAINT topup_reviewed_by_fk
    FOREIGN KEY ("reviewed_by") REFERENCES "users" ("user_id")
    ON DELETE SET NULL
);

CREATE INDEX "topup_user_id_idx" ON "topup" ("user_id");
CREATE INDEX "topup_status_created_at_idx" ON "topup" ("status", "created_at" DESC);
