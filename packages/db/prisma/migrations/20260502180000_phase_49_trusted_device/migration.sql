-- Phase 49 — Trusted device records for the email-OTP login gate.
-- Browser holds a random cookie; we store only its SHA-256 hash.
-- Within `expires_at` (default 7 days from check-in) the OTP gate
-- is skipped for that browser.

CREATE TABLE "trusted_device" (
    "id"               SERIAL                        NOT NULL,
    "user_id"          INTEGER                       NOT NULL,
    "fingerprint_hash" VARCHAR(64)                   NOT NULL,
    "label"            VARCHAR(120),
    "created_at"       TIMESTAMP(3) DEFAULT NOW()    NOT NULL,
    "expires_at"       TIMESTAMP(3)                  NOT NULL,
    CONSTRAINT "trusted_device_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "trusted_device_fingerprint_hash_key"
    ON "trusted_device"("fingerprint_hash");

CREATE INDEX "trusted_device_user_id_expires_at_idx"
    ON "trusted_device"("user_id", "expires_at");

ALTER TABLE "trusted_device"
    ADD CONSTRAINT "trusted_device_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("user_id")
    ON DELETE CASCADE ON UPDATE CASCADE;
