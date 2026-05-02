-- Phase 48 — IP-level ban list. Independent from User.bannedAt
-- because IPs aren't tied to a single account (NAT, VPN, shared
-- workstations). Middleware reads cached entries before requests
-- reach the auth layer so abusive networks get blocked early.

CREATE TABLE "banned_ip" (
  "banned_ip_id"  SERIAL PRIMARY KEY,
  "ip_address"    VARCHAR(45) NOT NULL,  -- IPv4 + IPv6 max length
  "reason"        VARCHAR(255),
  "banned_by_id"  INTEGER NOT NULL,
  "banned_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at"    TIMESTAMP(3),  -- NULL = forever
  CONSTRAINT "banned_ip_banned_by_id_fkey"
    FOREIGN KEY ("banned_by_id") REFERENCES "users"("user_id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Unique on ip_address so we never have two ban rows for the same IP.
CREATE UNIQUE INDEX "banned_ip_ip_address_key" ON "banned_ip" ("ip_address");

-- Same column also gets a regular index for the middleware lookup
-- (covered by the unique above on Postgres but kept explicit for clarity).
CREATE INDEX "banned_ip_ip_address_idx" ON "banned_ip" ("ip_address");
