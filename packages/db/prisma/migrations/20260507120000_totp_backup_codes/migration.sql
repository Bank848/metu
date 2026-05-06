-- 2FA backup codes — 10 single-use recovery codes that work in place of
-- a TOTP code when the user can't access their authenticator app
-- (lost phone, etc.).
--
-- Storage: SHA-256 hashes of the plaintext codes. Plaintext is shown
-- to the user ONCE at generation time and never persisted. Each
-- successful use removes the matching hash from the array, so the
-- code is single-use by construction.
--
-- NULL when 2FA is disabled. An empty array means 2FA is enabled but
-- the user has consumed every backup code (they should regenerate).

ALTER TABLE "users"
  ADD COLUMN "totp_backup_codes" TEXT[];

COMMENT ON COLUMN "users"."totp_backup_codes" IS
  'SHA-256 hashes of single-use TOTP backup codes. NULL when 2FA disabled. Plaintext is shown to the user only once at generation time and never persisted.';
