-- Phase 23.3 — TOTP step-up recency tracker on the better-auth Session row.
--
-- `last_totp_at` is set whenever the user passes a TOTP step-up
-- challenge for a sensitive action (withdrawal, password change,
-- unlink Google, account deletion). The requireRecent2FA(maxMin)
-- middleware checks the column's age before allowing the action;
-- past the threshold, the middleware throws 403 TotpStepUpRequired
-- and the client renders the step-up modal.
--
-- NULL means "never proven on this session" — the user must complete
-- a step-up challenge before any sensitive action even on a fresh
-- login. Effectively means logging in with a TOTP code to satisfy
-- the existing 2FA gate doesn't auto-bless the session for sensitive
-- actions; that's deliberate (defence in depth — sign-in TOTP and
-- step-up TOTP are distinct trust signals).

ALTER TABLE "session"
  ADD COLUMN "last_totp_at" TIMESTAMP(3) NULL;
