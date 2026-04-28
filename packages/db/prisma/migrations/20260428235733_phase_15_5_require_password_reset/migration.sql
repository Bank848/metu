-- Phase 15.5 — admin force-password-reset flag.
--
-- When set, the user is required to change their password before
-- any other authed action surfaces (BFF redirects to /profile/edit
-- with a banner). Cleared by a successful changePassword or
-- setPassword.
--
-- DEFAULT false + NOT NULL — every existing user gets false on the
-- backfill; admins flip it on demand from /admin/users.
ALTER TABLE "users"
  ADD COLUMN "require_password_reset" BOOLEAN NOT NULL DEFAULT false;
