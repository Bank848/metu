-- Phase 16.3 — Mode A swap, retry migration.
--
-- The original 20260429070000_phase_16_3_credential_account_backfill
-- failed on the first deploy attempt with a column-name typo
-- (`u.created_at` should have been `u.created_date` for the legacy
-- `users` table). The post-failure cleanup ran `prisma migrate
-- resolve --rolled-back`, which marks the row as terminal — Prisma's
-- subsequent `migrate deploy` will NOT re-attempt rolled-back
-- migrations even after the SQL is fixed.
--
-- This second migration carries the now-correct backfill so the
-- pipeline picks it up. ON CONFLICT DO NOTHING means it's also safe
-- if the first migration partially populated rows (it didn't, but
-- the guard costs nothing and matches the original's idempotence).

INSERT INTO "account" (user_id, provider_id, account_id, password, created_at, updated_at)
SELECT
  u.user_id                            AS user_id,
  'credential'                         AS provider_id,
  u.email                              AS account_id,
  u.password                           AS password,
  COALESCE(u.created_date, NOW())      AS created_at,
  NOW()                                AS updated_at
FROM "users" u
WHERE u.password IS NOT NULL
  AND u.deleted_at IS NULL
ON CONFLICT (provider_id, account_id) DO NOTHING;
