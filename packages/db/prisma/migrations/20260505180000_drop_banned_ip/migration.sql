-- Drop the IP-ban feature. Account-level bans (User.bannedAt) cover the
-- abuse cases we actually need; IP-level adds NAT-collateral risk and
-- isn't worth the operational overhead for the defense.
DROP TABLE IF EXISTS "banned_ip" CASCADE;
