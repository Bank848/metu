-- AlterTable: ProductItem.sampleUrl
ALTER TABLE "product_item" ADD COLUMN "sample_url" TEXT;

-- AlterTable: Order gift fields
ALTER TABLE "orders" ADD COLUMN "gift_recipient_email" VARCHAR(80);
ALTER TABLE "orders" ADD COLUMN "gift_message"          VARCHAR(500);

-- CreateTable: ProductQuestion
CREATE TABLE "product_question" (
    "question_id"  SERIAL NOT NULL,
    "product_id"   INTEGER NOT NULL,
    "asker_id"     INTEGER NOT NULL,
    "body"         VARCHAR(500) NOT NULL,
    "answer"       VARCHAR(500),
    "answered_at"  TIMESTAMP(3),
    "answerer_id"  INTEGER,
    "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_question_pkey" PRIMARY KEY ("question_id")
);

CREATE INDEX "product_question_product_id_idx"            ON "product_question"("product_id");
CREATE INDEX "product_question_product_id_created_at_idx" ON "product_question"("product_id", "created_at");
CREATE INDEX "product_question_asker_id_idx"              ON "product_question"("asker_id");

ALTER TABLE "product_question" ADD CONSTRAINT "product_question_product_id_fkey"  FOREIGN KEY ("product_id")  REFERENCES "product"("product_id") ON DELETE CASCADE  ON UPDATE CASCADE;
ALTER TABLE "product_question" ADD CONSTRAINT "product_question_asker_id_fkey"    FOREIGN KEY ("asker_id")    REFERENCES "users"("user_id")    ON DELETE CASCADE  ON UPDATE CASCADE;
ALTER TABLE "product_question" ADD CONSTRAINT "product_question_answerer_id_fkey" FOREIGN KEY ("answerer_id") REFERENCES "users"("user_id")    ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable: StockAlert
CREATE TABLE "stock_alert" (
    "alert_id"        SERIAL NOT NULL,
    "user_id"         INTEGER NOT NULL,
    "product_item_id" INTEGER NOT NULL,
    "notified_at"     TIMESTAMP(3),
    "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_alert_pkey" PRIMARY KEY ("alert_id")
);

CREATE UNIQUE INDEX "stock_alert_user_id_product_item_id_key"     ON "stock_alert"("user_id", "product_item_id");
CREATE INDEX        "stock_alert_product_item_id_notified_at_idx" ON "stock_alert"("product_item_id", "notified_at");

ALTER TABLE "stock_alert" ADD CONSTRAINT "stock_alert_user_id_fkey"         FOREIGN KEY ("user_id")         REFERENCES "users"("user_id")              ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stock_alert" ADD CONSTRAINT "stock_alert_product_item_id_fkey" FOREIGN KEY ("product_item_id") REFERENCES "product_item"("product_item_id") ON DELETE CASCADE ON UPDATE CASCADE;
