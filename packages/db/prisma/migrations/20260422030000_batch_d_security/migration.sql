-- AlterTable: soft-delete columns on User, Store, Product
ALTER TABLE "users"   ADD COLUMN "deleted_at" TIMESTAMP(3);
ALTER TABLE "store"   ADD COLUMN "deleted_at" TIMESTAMP(3);
ALTER TABLE "product" ADD COLUMN "deleted_at" TIMESTAMP(3);

CREATE INDEX "users_deleted_at_idx"   ON "users"("deleted_at");
CREATE INDEX "store_deleted_at_idx"   ON "store"("deleted_at");
CREATE INDEX "product_deleted_at_idx" ON "product"("deleted_at");

-- CreateTable: PasswordResetToken
CREATE TABLE "password_reset_token" (
    "token_id"    SERIAL NOT NULL,
    "user_id"     INTEGER NOT NULL,
    "token_hash"  VARCHAR(64) NOT NULL,
    "expires_at"  TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_token_pkey" PRIMARY KEY ("token_id")
);

CREATE UNIQUE INDEX "password_reset_token_token_hash_key" ON "password_reset_token"("token_hash");
CREATE INDEX        "password_reset_token_user_id_idx"    ON "password_reset_token"("user_id");
CREATE INDEX        "password_reset_token_expires_at_idx" ON "password_reset_token"("expires_at");

ALTER TABLE "password_reset_token" ADD CONSTRAINT "password_reset_token_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: AuditLog
CREATE TABLE "audit_log" (
    "log_id"      SERIAL NOT NULL,
    "actor_id"    INTEGER,
    "action"      VARCHAR(60) NOT NULL,
    "target_type" VARCHAR(40) NOT NULL,
    "target_id"   INTEGER NOT NULL,
    "meta"        JSONB,
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("log_id")
);

CREATE INDEX "audit_log_actor_id_idx"                  ON "audit_log"("actor_id");
CREATE INDEX "audit_log_target_type_target_id_idx"     ON "audit_log"("target_type", "target_id");
CREATE INDEX "audit_log_created_at_idx"                ON "audit_log"("created_at");

ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_fkey"
  FOREIGN KEY ("actor_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;
