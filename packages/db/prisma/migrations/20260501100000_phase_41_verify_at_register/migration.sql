-- Phase 41 - mandatory email + phone verification at register.
-- Adds the storage that the new register/verify flow needs.

-- Phone OTP hash + expiry on the user row. Stored on User (not a
-- separate table) because there's at most one pending OTP per user
-- at a time, and the columns sit naturally next to phone /
-- phone_verified_at.
ALTER TABLE "users"
  ADD COLUMN "phone_otp_hash"       VARCHAR(64) NULL,
  ADD COLUMN "phone_otp_expires_at" TIMESTAMP(3) NULL;

-- Email-verify tokens, mirroring password_reset_token pattern
-- (SHA-256 of the URL token, single-use, TTL).
CREATE TABLE "email_verify_token" (
  "token_id"    SERIAL       PRIMARY KEY,
  "user_id"     INT          NOT NULL,
  "token_hash"  VARCHAR(64)  NOT NULL UNIQUE,
  "expires_at"  TIMESTAMP(3) NOT NULL,
  "consumed_at" TIMESTAMP(3),
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "email_verify_token_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("user_id")
    ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "email_verify_token_user_id_idx"    ON "email_verify_token" ("user_id");
CREATE INDEX "email_verify_token_expires_at_idx" ON "email_verify_token" ("expires_at");

-- Backfill existing accounts as verified so they keep being able to
-- log in. New registrations after this migration go through the
-- mandatory verify flow.
UPDATE "users"
   SET "email_verified"     = TRUE,
       "phone_verified_at"  = COALESCE("phone_verified_at", CURRENT_TIMESTAMP);
