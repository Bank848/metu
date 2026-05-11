-- Widen order_item.delivered_key VARCHAR(80) → TEXT so a stackable
-- license_key purchase (qty > 1) can hold one newline-joined key per
-- unit. The old 80-char cap silently broke finalizeOrder for qty>4
-- with P2000 "value too long for column" — see commit f7… for the
-- application fix and order #140 / #142 / #143 for the symptom.
ALTER TABLE "order_item" ALTER COLUMN "delivered_key" TYPE TEXT;
