-- AlterTable: Product gets an isActive flag (default true so existing rows stay live)
ALTER TABLE "product" ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX "product_is_active_idx" ON "product"("is_active");

-- CreateTable: Message
CREATE TABLE "message" (
    "message_id"   SERIAL NOT NULL,
    "sender_id"    INTEGER NOT NULL,
    "recipient_id" INTEGER NOT NULL,
    "order_id"     INTEGER,
    "product_id"   INTEGER,
    "body"         VARCHAR(1000) NOT NULL,
    "read_at"      TIMESTAMP(3),
    "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_pkey" PRIMARY KEY ("message_id")
);

-- CreateIndex
CREATE INDEX "message_sender_id_idx" ON "message"("sender_id");

-- CreateIndex
CREATE INDEX "message_recipient_id_idx" ON "message"("recipient_id");

-- CreateIndex (composite for the unread-inbox query)
CREATE INDEX "message_recipient_id_read_at_idx" ON "message"("recipient_id", "read_at");

-- CreateIndex
CREATE INDEX "message_created_at_idx" ON "message"("created_at");

-- AddForeignKey
ALTER TABLE "message" ADD CONSTRAINT "message_sender_id_fkey"    FOREIGN KEY ("sender_id")    REFERENCES "users"("user_id")    ON DELETE CASCADE  ON UPDATE CASCADE;
ALTER TABLE "message" ADD CONSTRAINT "message_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "users"("user_id")    ON DELETE CASCADE  ON UPDATE CASCADE;
ALTER TABLE "message" ADD CONSTRAINT "message_order_id_fkey"     FOREIGN KEY ("order_id")     REFERENCES "orders"("order_id")  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "message" ADD CONSTRAINT "message_product_id_fkey"   FOREIGN KEY ("product_id")   REFERENCES "product"("product_id") ON DELETE SET NULL ON UPDATE CASCADE;
