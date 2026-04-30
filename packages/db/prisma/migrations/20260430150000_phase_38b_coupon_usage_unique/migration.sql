-- Phase 38B: enforce Business Rule 4.i ("1 coupon ใช้ได้แค่ 1 ครั้งต่อ 1 บัญชี")
-- at the schema level. Without this, the same user can apply the same
-- coupon multiple times -- the doc promised single-use-per-user but the
-- application code never pre-checked, and the schema had no constraint.
--
-- The composite UNIQUE doubles as an index for the existing
-- "has this user used this coupon" lookup that runs on every checkout
-- with a coupon code, so the dedicated single-column indexes on
-- coupon_id and user_id can stay (Postgres uses whichever fits the
-- query best).
--
-- Idempotency note: if any duplicate (coupon_id, user_id) rows exist
-- in the DB at deploy time the ALTER will fail. Pre-check with:
--   SELECT coupon_id, user_id, COUNT(*) FROM coupon_usage
--   GROUP BY coupon_id, user_id HAVING COUNT(*) > 1;
-- and dedupe by keeping the earliest row per pair.

-- Defensive dedupe: keep only the row with the smallest usage_id per
-- (coupon_id, user_id) pair. No-op when there are no duplicates.
DELETE FROM "coupon_usage" cu1
USING "coupon_usage" cu2
WHERE cu1.coupon_id = cu2.coupon_id
  AND cu1.user_id   = cu2.user_id
  AND cu1.usage_id  > cu2.usage_id;

ALTER TABLE "coupon_usage"
  ADD CONSTRAINT "coupon_usage_coupon_id_user_id_key"
  UNIQUE ("coupon_id", "user_id");
