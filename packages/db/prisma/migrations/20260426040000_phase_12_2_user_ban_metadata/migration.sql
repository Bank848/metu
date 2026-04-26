-- Phase 12.2 / S8 proposal — moderation metadata on users table.
--
-- Adds two nullable columns + one index. Both default to NULL and
-- only populate when an admin moderates the account; existing rows
-- (active users + previously self-deleted accounts) need no backfill.
--
-- Semantics:
--   bannedAt     NULL  + deletedAt NULL   → active user
--   bannedAt     NULL  + deletedAt SET    → user soft-deleted themselves
--   bannedAt     SET   + deletedAt SET    → admin removed for cause
--                                           (always set together; the
--                                           ban implies deletion in our
--                                           current convention)
--
-- bannedReason is capped at 120 chars — long enough for the typical
-- moderation note ("racial slur in display name", "fraud pattern X")
-- but short enough to fit a single-line table cell. Longer rationale
-- belongs in the AuditLog meta JSON.
ALTER TABLE "users"
  ADD COLUMN "banned_at"     TIMESTAMP(3),
  ADD COLUMN "banned_reason" VARCHAR(120);

CREATE INDEX IF NOT EXISTS "users_banned_at_idx" ON "users" ("banned_at");
