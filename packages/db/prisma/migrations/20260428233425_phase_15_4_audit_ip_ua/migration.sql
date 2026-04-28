-- Phase 15.4 — audit-log IP + user-agent columns.
--
-- Both nullable + no default — pre-15.4 audit rows stay NULL,
-- post-15.4 rows get populated when the controller passes the
-- request context through to audit().
--
-- VARCHAR(45) is enough for an IPv6 address (longest possible:
-- 8 hex groups × 4 chars + 7 separators = 39, plus 6 chars for
-- a v4-in-v6 prefix tail). VARCHAR(255) for UA matches every
-- other UA column we have in this schema.
ALTER TABLE "audit_log"
  ADD COLUMN "ip_address"  VARCHAR(45),
  ADD COLUMN "user_agent"  VARCHAR(255);
