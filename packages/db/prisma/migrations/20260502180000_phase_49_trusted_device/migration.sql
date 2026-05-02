-- Phase 49 — Trusted device records for the email-OTP login gate.
-- Browser holds a random cookie; we store only its SHA-256 hash.
-- Within `expires_at` (default 7 days from check-in) the OTP gate
-- is skipped for that browser.
--
-- Idempotent on purpose: this table was first created manually via
-- the Supabase MCP `apply_migration` tool ahead of the deploy, so
-- when `prisma migrate deploy` ran during the Fly release it tripped
-- on the existing relation. Switching to `IF NOT EXISTS` + a DO
-- block for the FK lets the migration replay safely.

CREATE TABLE IF NOT EXISTS "trusted_device" (
    "id"               SERIAL                        NOT NULL,
    "user_id"          INTEGER                       NOT NULL,
    "fingerprint_hash" VARCHAR(64)                   NOT NULL,
    "label"            VARCHAR(120),
    "created_at"       TIMESTAMP(3) DEFAULT NOW()    NOT NULL,
    "expires_at"       TIMESTAMP(3)                  NOT NULL,
    CONSTRAINT "trusted_device_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "trusted_device_fingerprint_hash_key"
    ON "trusted_device"("fingerprint_hash");

CREATE INDEX IF NOT EXISTS "trusted_device_user_id_expires_at_idx"
    ON "trusted_device"("user_id", "expires_at");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'trusted_device_user_id_fkey'
    ) THEN
        ALTER TABLE "trusted_device"
            ADD CONSTRAINT "trusted_device_user_id_fkey"
            FOREIGN KEY ("user_id") REFERENCES "users"("user_id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
