-- Phase 16.3 — Mode A swap.
--
-- Backfills better-auth's `account` table with one credential row per
-- existing User that has a non-null password. Once this migration
-- runs, better-auth's `signInEmail({ email, password })` can verify
-- credentials against the existing bcrypt hashes (via the bcrypt
-- adapter wired into `apps/server/src/lib/auth.ts`), and we can use
-- better-auth as the single source of truth for sessions.
--
-- Idempotent — safe to re-run via `prisma migrate deploy`. The
-- `ON CONFLICT DO NOTHING` clause on the (provider_id, account_id)
-- unique index handles already-backfilled rows.
--
-- Schema mapping reminder (from schema.prisma's Account model):
--   id            INT PK auto   — autoincremented; we omit from INSERT
--   user_id       INT FK        — User.user_id
--   provider_id   VARCHAR       — "credential" (better-auth's reserved string)
--   account_id    VARCHAR       — better-auth uses email as the lookup key
--                                 for the credential provider
--   password      TEXT          — bcrypt hash kept as-is (the bcrypt
--                                 verify adapter in lib/auth.ts handles
--                                 the format swap from scrypt)
--   created_at    TIMESTAMP
--   updated_at    TIMESTAMP

-- Note: the legacy `users` table uses `created_date` (not the
-- `created_at` convention every newer table uses). COALESCE fallback
-- to NOW() in case the column ever holds NULL.
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
