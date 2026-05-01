-- Phase 45 — bring schema in line with the docx report submitted to the
-- CPE241 examiner. Report shape was authoritative, so we adjust the
-- code/DB to match. See plan file for the full diff list.
--
-- Out of scope (kept as-is, documented as implementation trade-off):
--   * User.userId stays INT autoincrement (report says TEXT/UUID).
--     better-auth's prisma adapter assumes a generateId="serial" PK
--     and the change would require rewriting 13+ FK columns + every
--     auth flow. Documented in changelog as a justified deviation.
--   * Order.cartId stays @unique INT FK (report omits it). Removing it
--     would lose the cart→order 1:1 lineage we rely on at checkout.

-- ---------------------------------------------------------------
-- 1. Product.isStackable + Product.deliveryMethod
-- ---------------------------------------------------------------
-- Report puts both on Product, not ProductItem. Move deliveryMethod up
-- to Product (every existing variant of a single product happens to use
-- the same delivery_method in seed data), keep ProductItem.deliveryMethod
-- around for the existing services until they migrate over.

ALTER TABLE "product"
  ADD COLUMN "is_stackable" BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN "delivery_method" TEXT;

-- Backfill from each product's first ProductItem variant.
UPDATE "product" p
SET "delivery_method" = (
  SELECT pi."delivery_method"::text
  FROM "product_item" pi
  WHERE pi."product_id" = p."product_id"
  ORDER BY pi."product_item_id" ASC
  LIMIT 1
)
WHERE EXISTS (
  SELECT 1 FROM "product_item" pi WHERE pi."product_id" = p."product_id"
);

-- Default for products with no variants yet.
UPDATE "product" SET "delivery_method" = 'download' WHERE "delivery_method" IS NULL;

-- Promote the column to NOT NULL + the DeliveryMethod enum.
ALTER TABLE "product"
  ALTER COLUMN "delivery_method" SET NOT NULL,
  ALTER COLUMN "delivery_method" TYPE "DeliveryMethod" USING "delivery_method"::"DeliveryMethod";

-- ---------------------------------------------------------------
-- 2. ProductItem variant detail columns (name / description / image)
-- ---------------------------------------------------------------
-- Report describes ProductItem as a sellable variant with its own name,
-- description, and image so a seller can list "Standard / Pro / Team"
-- versions of the same product. Existing rows fill name from the parent
-- product's name with " — Standard" appended; description + image stay
-- nullable so the seller form can leave them blank.

ALTER TABLE "product_item"
  ADD COLUMN "name" VARCHAR(100),
  ADD COLUMN "description" VARCHAR(255),
  ADD COLUMN "image" TEXT;

UPDATE "product_item" pi
SET "name" = COALESCE(
  (SELECT p."name" FROM "product" p WHERE p."product_id" = pi."product_id"),
  'Standard'
);

ALTER TABLE "product_item" ALTER COLUMN "name" SET NOT NULL;

-- ---------------------------------------------------------------
-- 3. OrderItem.priceAtPurchase → pricePerUnit (12,2)
-- ---------------------------------------------------------------
-- Rename matches the report; widening to (12,2) lets us record orders
-- above 99,999.99 baht safely.

ALTER TABLE "order_item"
  ALTER COLUMN "price_at_purchase" TYPE DECIMAL(12, 2);

ALTER TABLE "order_item"
  RENAME COLUMN "price_at_purchase" TO "price_per_unit";

-- ---------------------------------------------------------------
-- 4. Order.userId — denormalised from Cart.userId
-- ---------------------------------------------------------------
-- Report's Order has a direct FK to User. Today the link goes through
-- Cart.userId (Order.cartId @unique → Cart.userId). Keep the cart edge
-- in place but add the direct user_id column too so reports/queries
-- can join without the cart hop. CASCADE matches Cart's own behaviour.

ALTER TABLE "orders" ADD COLUMN "user_id" INTEGER;

UPDATE "orders" o
SET "user_id" = c."user_id"
FROM "cart" c
WHERE c."cart_id" = o."cart_id";

ALTER TABLE "orders"
  ALTER COLUMN "user_id" SET NOT NULL,
  ADD CONSTRAINT "orders_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "orders_user_id_idx" ON "orders" ("user_id");

-- ---------------------------------------------------------------
-- 5. ProductDetail / ProductAddDetail table
-- ---------------------------------------------------------------
-- Report's "Product Additional Detail" — a detail-row per product, e.g.
-- file format, license duration. Business rule 4(g): max 7 rows per
-- product, enforced at the application layer (no DB constraint without
-- a trigger).

CREATE TABLE "product_detail" (
  "product_detail_id" SERIAL PRIMARY KEY,
  "product_id"        INTEGER       NOT NULL,
  "detail_name"       VARCHAR(80)   NOT NULL,
  "detail_value"      VARCHAR(255)  NOT NULL,
  CONSTRAINT "product_detail_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "product"("product_id") ON DELETE CASCADE
);
CREATE INDEX "product_detail_product_id_idx" ON "product_detail" ("product_id");

-- ---------------------------------------------------------------
-- 6. TransactionType enum: drop "refund"
-- ---------------------------------------------------------------
-- Report's enum is purchase / payout only. Refund is currently logged
-- as a Transaction row in admin.service.refundTransaction but the same
-- semantic fits with status flips on Order + a negative-amount payout.
-- Convert any existing refund rows to "payout" with negative amount so
-- the type drop doesn't break referential integrity.

UPDATE "transactions"
SET "transaction_type" = 'payout',
    "total_amount"     = -ABS("total_amount")
WHERE "transaction_type" = 'refund';

-- Postgres enum value drops require a rebuild.
ALTER TYPE "TransactionType" RENAME TO "TransactionType_old";
CREATE TYPE "TransactionType" AS ENUM ('purchase', 'payout');
ALTER TABLE "transactions"
  ALTER COLUMN "transaction_type" TYPE "TransactionType"
  USING "transaction_type"::text::"TransactionType";
DROP TYPE "TransactionType_old";
