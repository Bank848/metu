-- Phase 16.2 — TOTP 2FA columns on users.
--
-- Two-step enrolment:
--   1. POST /auth/totp/enroll-start  — server generates a base32 secret,
--      returns the otpauth:// URL + secret. UI renders QR. Secret is
--      stored in totp_secret with totp_enabled = false (pending).
--   2. POST /auth/totp/enroll-verify — user types the 6-digit code from
--      their authenticator. If it verifies, totp_enabled flips to true
--      and 2FA is live for that account.
--
-- Login: /auth/login takes an optional totpCode. If totp_enabled = true
-- but no code (or wrong code), respond 401 NeedsTotp / InvalidTotp.
-- The UI then prompts for the code as a second step.
--
-- Disable: POST /auth/totp/disable — single click after re-verification
-- with current password (handled in the service layer).
--
-- Both columns nullable + default false — existing users opt-in via
-- /profile/edit.
ALTER TABLE "users"
  ADD COLUMN "totp_secret"  VARCHAR(64),
  ADD COLUMN "totp_enabled" BOOLEAN NOT NULL DEFAULT false;
