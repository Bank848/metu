-- DropForeignKey
ALTER TABLE "product_detail" DROP CONSTRAINT "product_detail_product_id_fkey";

-- AlterTable
ALTER TABLE "system_setting" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AddForeignKey
ALTER TABLE "product_detail" ADD CONSTRAINT "product_detail_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product"("product_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "order_stripe_pi_idx" RENAME TO "orders_stripe_payment_intent_id_idx";

-- RenameIndex
ALTER INDEX "store_stripe_account_id_idx" RENAME TO "store_stripe_account_id_key";
