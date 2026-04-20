-- DropIndex
DROP INDEX "cart_user_id_key";

-- CreateIndex
CREATE INDEX "cart_user_id_status_idx" ON "cart"("user_id", "status");
