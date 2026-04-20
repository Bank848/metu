-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('male', 'female', 'other');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('buyer', 'seller', 'admin');

-- CreateEnum
CREATE TYPE "CartStatus" AS ENUM ('active', 'checked_out', 'expired');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('pending', 'paid', 'fulfilled', 'cancelled', 'refunded');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('purchase', 'payout', 'refund');

-- CreateEnum
CREATE TYPE "DeliveryMethod" AS ENUM ('download', 'email', 'license_key', 'streaming');

-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('percent', 'fixed');

-- CreateTable
CREATE TABLE "country" (
    "country_id" SERIAL NOT NULL,
    "country_code" INTEGER NOT NULL,
    "name" VARCHAR(60) NOT NULL,

    CONSTRAINT "country_pkey" PRIMARY KEY ("country_id")
);

-- CreateTable
CREATE TABLE "users" (
    "user_id" SERIAL NOT NULL,
    "country_id" INTEGER,
    "password" TEXT NOT NULL,
    "username" VARCHAR(20) NOT NULL,
    "first_name" VARCHAR(40) NOT NULL,
    "last_name" VARCHAR(40) NOT NULL,
    "email" VARCHAR(80) NOT NULL,
    "gender" "Gender",
    "profile_image" TEXT,
    "date_of_birth" TIMESTAMP(3),
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "user_stats" (
    "user_id" INTEGER NOT NULL,
    "buyer_level" INTEGER NOT NULL DEFAULT 1,
    "seller_level" INTEGER NOT NULL DEFAULT 0,
    "role" "UserRole" NOT NULL DEFAULT 'buyer',
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_stats_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "business_type" (
    "type_id" SERIAL NOT NULL,
    "name" VARCHAR(30) NOT NULL,
    "description" VARCHAR(150) NOT NULL,

    CONSTRAINT "business_type_pkey" PRIMARY KEY ("type_id")
);

-- CreateTable
CREATE TABLE "store" (
    "store_id" SERIAL NOT NULL,
    "owner_id" INTEGER NOT NULL,
    "business_type_id" INTEGER NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "description" VARCHAR(255) NOT NULL,
    "profile_image" TEXT,
    "cover_image" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "store_pkey" PRIMARY KEY ("store_id")
);

-- CreateTable
CREATE TABLE "store_stats" (
    "stat_id" SERIAL NOT NULL,
    "store_id" INTEGER NOT NULL,
    "ctr" INTEGER NOT NULL DEFAULT 0,
    "rating" INTEGER NOT NULL DEFAULT 0,
    "response_time" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "store_stats_pkey" PRIMARY KEY ("stat_id")
);

-- CreateTable
CREATE TABLE "category" (
    "category_id" SERIAL NOT NULL,
    "category_name" VARCHAR(40) NOT NULL,
    "description" VARCHAR(150) NOT NULL,

    CONSTRAINT "category_pkey" PRIMARY KEY ("category_id")
);

-- CreateTable
CREATE TABLE "product_tag" (
    "tag_id" SERIAL NOT NULL,
    "tag_name" VARCHAR(30) NOT NULL,
    "tag_description" VARCHAR(150) NOT NULL,

    CONSTRAINT "product_tag_pkey" PRIMARY KEY ("tag_id")
);

-- CreateTable
CREATE TABLE "product" (
    "product_id" SERIAL NOT NULL,
    "store_id" INTEGER NOT NULL,
    "category_id" INTEGER NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_pkey" PRIMARY KEY ("product_id")
);

-- CreateTable
CREATE TABLE "product_item" (
    "product_item_id" SERIAL NOT NULL,
    "product_id" INTEGER NOT NULL,
    "delivery_method" "DeliveryMethod" NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "price" DECIMAL(10,2) NOT NULL,
    "discount_percent" INTEGER NOT NULL DEFAULT 0,
    "discount_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_item_pkey" PRIMARY KEY ("product_item_id")
);

-- CreateTable
CREATE TABLE "product_image" (
    "product_image_id" SERIAL NOT NULL,
    "product_id" INTEGER NOT NULL,
    "product_image" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "product_image_pkey" PRIMARY KEY ("product_image_id")
);

-- CreateTable
CREATE TABLE "product_review" (
    "review_id" SERIAL NOT NULL,
    "product_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_review_pkey" PRIMARY KEY ("review_id")
);

-- CreateTable
CREATE TABLE "product_n_tag" (
    "junction_id" SERIAL NOT NULL,
    "product_id" INTEGER NOT NULL,
    "tag_id" INTEGER NOT NULL,

    CONSTRAINT "product_n_tag_pkey" PRIMARY KEY ("junction_id")
);

-- CreateTable
CREATE TABLE "cart" (
    "cart_id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "status" "CartStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "expired_at" TIMESTAMP(3),
    "session_id" INTEGER,

    CONSTRAINT "cart_pkey" PRIMARY KEY ("cart_id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "transaction_id" SERIAL NOT NULL,
    "transaction_type" "TransactionType" NOT NULL,
    "user_id" INTEGER NOT NULL,
    "total_amount" DECIMAL(12,2) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("transaction_id")
);

-- CreateTable
CREATE TABLE "orders" (
    "order_id" SERIAL NOT NULL,
    "cart_id" INTEGER NOT NULL,
    "total_price" DECIMAL(12,2) NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'pending',
    "transaction_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "expired_at" TIMESTAMP(3),

    CONSTRAINT "orders_pkey" PRIMARY KEY ("order_id")
);

-- CreateTable
CREATE TABLE "order_item" (
    "order_item_id" SERIAL NOT NULL,
    "order_id" INTEGER NOT NULL,
    "product_item_id" INTEGER NOT NULL,
    "coupon_id" INTEGER,
    "quantity" INTEGER NOT NULL,
    "price_at_purchase" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "order_item_pkey" PRIMARY KEY ("order_item_id")
);

-- CreateTable
CREATE TABLE "coupon" (
    "coupon_id" SERIAL NOT NULL,
    "store_id" INTEGER NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "usage_limit" INTEGER NOT NULL,
    "discount_type" "DiscountType" NOT NULL,
    "discount_value" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "coupon_pkey" PRIMARY KEY ("coupon_id")
);

-- CreateTable
CREATE TABLE "coupon_usage" (
    "usage_id" SERIAL NOT NULL,
    "coupon_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coupon_usage_pkey" PRIMARY KEY ("usage_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_country_id_idx" ON "users"("country_id");

-- CreateIndex
CREATE INDEX "users_created_date_idx" ON "users"("created_date");

-- CreateIndex
CREATE INDEX "user_stats_role_idx" ON "user_stats"("role");

-- CreateIndex
CREATE UNIQUE INDEX "store_owner_id_key" ON "store"("owner_id");

-- CreateIndex
CREATE INDEX "store_business_type_id_idx" ON "store"("business_type_id");

-- CreateIndex
CREATE INDEX "store_created_at_idx" ON "store"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "store_stats_store_id_key" ON "store_stats"("store_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_tag_tag_name_key" ON "product_tag"("tag_name");

-- CreateIndex
CREATE INDEX "product_store_id_idx" ON "product"("store_id");

-- CreateIndex
CREATE INDEX "product_category_id_idx" ON "product"("category_id");

-- CreateIndex
CREATE INDEX "product_item_product_id_idx" ON "product_item"("product_id");

-- CreateIndex
CREATE INDEX "product_image_product_id_idx" ON "product_image"("product_id");

-- CreateIndex
CREATE INDEX "product_review_product_id_idx" ON "product_review"("product_id");

-- CreateIndex
CREATE INDEX "product_review_user_id_idx" ON "product_review"("user_id");

-- CreateIndex
CREATE INDEX "product_n_tag_tag_id_idx" ON "product_n_tag"("tag_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_n_tag_product_id_tag_id_key" ON "product_n_tag"("product_id", "tag_id");

-- CreateIndex
CREATE UNIQUE INDEX "cart_user_id_key" ON "cart"("user_id");

-- CreateIndex
CREATE INDEX "cart_status_idx" ON "cart"("status");

-- CreateIndex
CREATE INDEX "transactions_user_id_idx" ON "transactions"("user_id");

-- CreateIndex
CREATE INDEX "transactions_transaction_type_idx" ON "transactions"("transaction_type");

-- CreateIndex
CREATE UNIQUE INDEX "orders_cart_id_key" ON "orders"("cart_id");

-- CreateIndex
CREATE INDEX "orders_status_idx" ON "orders"("status");

-- CreateIndex
CREATE INDEX "orders_created_at_idx" ON "orders"("created_at");

-- CreateIndex
CREATE INDEX "order_item_order_id_idx" ON "order_item"("order_id");

-- CreateIndex
CREATE INDEX "order_item_product_item_id_idx" ON "order_item"("product_item_id");

-- CreateIndex
CREATE INDEX "coupon_code_idx" ON "coupon"("code");

-- CreateIndex
CREATE INDEX "coupon_is_active_idx" ON "coupon"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "coupon_store_id_code_key" ON "coupon"("store_id", "code");

-- CreateIndex
CREATE INDEX "coupon_usage_coupon_id_idx" ON "coupon_usage"("coupon_id");

-- CreateIndex
CREATE INDEX "coupon_usage_user_id_idx" ON "coupon_usage"("user_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "country"("country_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_stats" ADD CONSTRAINT "user_stats_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store" ADD CONSTRAINT "store_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store" ADD CONSTRAINT "store_business_type_id_fkey" FOREIGN KEY ("business_type_id") REFERENCES "business_type"("type_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_stats" ADD CONSTRAINT "store_stats_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "store"("store_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product" ADD CONSTRAINT "product_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "store"("store_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product" ADD CONSTRAINT "product_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "category"("category_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_item" ADD CONSTRAINT "product_item_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product"("product_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_image" ADD CONSTRAINT "product_image_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product"("product_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_review" ADD CONSTRAINT "product_review_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product"("product_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_review" ADD CONSTRAINT "product_review_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_n_tag" ADD CONSTRAINT "product_n_tag_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product"("product_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_n_tag" ADD CONSTRAINT "product_n_tag_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "product_tag"("tag_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart" ADD CONSTRAINT "cart_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_cart_id_fkey" FOREIGN KEY ("cart_id") REFERENCES "cart"("cart_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("transaction_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item" ADD CONSTRAINT "order_item_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("order_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item" ADD CONSTRAINT "order_item_product_item_id_fkey" FOREIGN KEY ("product_item_id") REFERENCES "product_item"("product_item_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item" ADD CONSTRAINT "order_item_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "coupon"("coupon_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon" ADD CONSTRAINT "coupon_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "store"("store_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_usage" ADD CONSTRAINT "coupon_usage_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "coupon"("coupon_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_usage" ADD CONSTRAINT "coupon_usage_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
