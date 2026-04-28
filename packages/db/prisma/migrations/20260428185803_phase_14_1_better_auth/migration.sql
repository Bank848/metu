-- Phase 14.1 — better-auth schema setup.
--
-- Adds the three tables better-auth's Prisma adapter expects
-- (account, session, verification) plus the User-side fields
-- needed for OAuth-only signups + Phase 14.4 OTP scaffold.
--
-- Strategy: better-auth runs with `advanced.database.generateId =
-- "serial"` so every PK uses BIGSERIAL/Int instead of cuid strings.
-- This matches our existing User.user_id Int PK, so Account/Session
-- FKs are clean Int → Int joins (no cross-type pain).
--
-- No data migration needed — existing user rows get
-- email_verified=false (the column default). The password column
-- becomes nullable so future Google-only signups can have NULL
-- passwords; existing rows are unaffected (they all have hashes).
--
-- Phase 14.2 swaps middleware/auth.ts to read better-auth's
-- session cookie. This migration is plumbing-only — every API
-- continues to work identically.

-- =============================================================================
--  USER additions
-- =============================================================================

ALTER TABLE "users"
  -- Make password nullable for future OAuth-only signups (Phase 14.2).
  -- Existing rows keep their bcrypt hashes; nothing to backfill.
  ALTER COLUMN "password" DROP NOT NULL,

  -- better-auth's `emailVerified` boolean field. We map it via the
  -- betterAuth() user.fields config so the runtime reads/writes
  -- this column. Defaults to false; password-login flow doesn't
  -- gate on it but Google sign-in will set it true on create.
  ADD COLUMN "email_verified" BOOLEAN NOT NULL DEFAULT false,

  -- Phase 14.4 OTP scaffold — phone number + verification timestamp.
  -- Both nullable; only populated when the buyer enrols.
  ADD COLUMN "phone"             VARCHAR(20),
  ADD COLUMN "phone_verified_at" TIMESTAMP(3);

-- =============================================================================
--  ACCOUNT — one row per (user, OAuth provider) link
-- =============================================================================
-- Replaces the original Phase 14 plan's `User.googleId` column —
-- better-auth's Account table is extensible: future Apple / GitHub
-- providers slot in without further schema changes.
CREATE TABLE "account" (
  "id"                       SERIAL          PRIMARY KEY,
  "user_id"                  INTEGER         NOT NULL,
  "provider_id"              VARCHAR(40)     NOT NULL,
  "account_id"               VARCHAR(255)    NOT NULL,
  "access_token"             TEXT,
  "refresh_token"            TEXT,
  "access_token_expires_at"  TIMESTAMP(3),
  "refresh_token_expires_at" TIMESTAMP(3),
  "scope"                    VARCHAR(255),
  "id_token"                 TEXT,
  "password"                 TEXT,
  "created_at"               TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"               TIMESTAMP(3)    NOT NULL,

  CONSTRAINT "account_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("user_id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "account_provider_id_account_id_key"
  ON "account"("provider_id", "account_id");
CREATE INDEX "account_user_id_idx" ON "account"("user_id");

-- =============================================================================
--  SESSION — server-side session cookie (Mode A)
-- =============================================================================
-- One row per active browser session. better-auth manages lifecycle
-- (insert on sign-in, delete on sign-out, expire on TTL).
CREATE TABLE "session" (
  "id"          SERIAL        PRIMARY KEY,
  "user_id"     INTEGER       NOT NULL,
  "token"       VARCHAR(120)  NOT NULL,
  "expires_at"  TIMESTAMP(3)  NOT NULL,
  "ip_address"  VARCHAR(45),
  "user_agent"  VARCHAR(255),
  "created_at"  TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"  TIMESTAMP(3)  NOT NULL,

  CONSTRAINT "session_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("user_id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "session_token_key" ON "session"("token");
CREATE INDEX "session_user_id_idx"   ON "session"("user_id");
CREATE INDEX "session_expires_at_idx" ON "session"("expires_at");

-- =============================================================================
--  VERIFICATION — email-verify codes, OTP codes, password reset tokens
-- =============================================================================
-- Generic key/value/ttl table for any short-lived code better-auth
-- needs to store. Used by emailVerification, magicLink, emailOTP,
-- and (Phase 14.4) the SMS-OTP plugin.
CREATE TABLE "verification" (
  "id"          SERIAL        PRIMARY KEY,
  "identifier"  VARCHAR(120)  NOT NULL,
  "value"       TEXT          NOT NULL,
  "expires_at"  TIMESTAMP(3)  NOT NULL,
  "created_at"  TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"  TIMESTAMP(3)  NOT NULL
);

CREATE INDEX "verification_identifier_idx" ON "verification"("identifier");
