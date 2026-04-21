-- CreateTable
CREATE TABLE "product_favorite" (
    "favorite_id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_favorite_pkey" PRIMARY KEY ("favorite_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "product_favorite_user_id_product_id_key" ON "product_favorite"("user_id", "product_id");

-- CreateIndex
CREATE INDEX "product_favorite_user_id_idx" ON "product_favorite"("user_id");

-- CreateIndex
CREATE INDEX "product_favorite_product_id_idx" ON "product_favorite"("product_id");

-- AddForeignKey
ALTER TABLE "product_favorite" ADD CONSTRAINT "product_favorite_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_favorite" ADD CONSTRAINT "product_favorite_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product"("product_id") ON DELETE CASCADE ON UPDATE CASCADE;
