/**
 * Phase 24 — auto-generated ER schema constant.
 *
 * DO NOT EDIT BY HAND. Regenerate via:
 *   node scripts/generate-er-schema.mjs
 *
 * Source-of-truth: packages/db/prisma/schema.prisma
 *
 * Consumed by:
 *   - apps/web/components/admin/ErDiagramView.tsx (renders entity cards)
 *   - apps/web/lib/admin/er-layout.ts (dagre auto-layout input)
 */

export interface ErField {
  /** Column name (snake_case, matching Postgres). */
  name: string;
  /** Display type: "INT", "VARCHAR(40)", "DECIMAL(10, 2)", "BOOLEAN", "DATETIME", enum names. */
  type: string;
  /** Primary key marker. */
  pk: boolean;
  /** Foreign key target, or null. */
  fk: { table: string; column: string } | null;
  /** Unique constraint (excluding PK). */
  unique: boolean;
  /** Nullable column (Prisma's `?` modifier). */
  nullable: boolean;
  /** 1-based position within its table. */
  ordinal: number;
}

export interface ErEntity {
  /** Postgres table name (snake_case). */
  table: string;
  fields: ErField[];
}

export interface ErRelationship {
  /** Child table (the side that holds the FK). */
  from: string;
  fromColumn: string;
  /** Parent table (the side referenced). */
  to: string;
  toColumn: string;
  /** Cardinality on the child→parent direction. */
  cardinality: "one-to-one" | "one-to-many";
  /** `true` when the FK column is nullable (zero-or-one / zero-or-many). */
  fromOptional: boolean;
}

export const ER_ENTITIES: ErEntity[] = [
  {
    "table": "country",
    "fields": [
      {
        "name": "country_id",
        "type": "INT",
        "pk": true,
        "fk": null,
        "unique": false,
        "nullable": false,
        "ordinal": 1
      },
      {
        "name": "country_code",
        "type": "INT",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": false,
        "ordinal": 2
      },
      {
        "name": "name",
        "type": "VARCHAR(60)",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": false,
        "ordinal": 3
      }
    ]
  },
  {
    "table": "users",
    "fields": [
      {
        "name": "user_id",
        "type": "INT",
        "pk": true,
        "fk": null,
        "unique": false,
        "nullable": false,
        "ordinal": 1
      },
      {
        "name": "country_id",
        "type": "INT",
        "pk": false,
        "fk": {
          "table": "country",
          "column": "country_id"
        },
        "unique": false,
        "nullable": true,
        "ordinal": 2
      },
      {
        "name": "password",
        "type": "TEXT",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": true,
        "ordinal": 3
      },
      {
        "name": "username",
        "type": "VARCHAR(20)",
        "pk": false,
        "fk": null,
        "unique": true,
        "nullable": false,
        "ordinal": 4
      },
      {
        "name": "first_name",
        "type": "VARCHAR(40)",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": false,
        "ordinal": 5
      },
      {
        "name": "last_name",
        "type": "VARCHAR(40)",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": false,
        "ordinal": 6
      },
      {
        "name": "email",
        "type": "VARCHAR(80)",
        "pk": false,
        "fk": null,
        "unique": true,
        "nullable": false,
        "ordinal": 7
      },
      {
        "name": "email_verified",
        "type": "BOOLEAN",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": false,
        "ordinal": 8
      },
      {
        "name": "gender",
        "type": "GENDER",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": true,
        "ordinal": 9
      },
      {
        "name": "profile_image",
        "type": "TEXT",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": true,
        "ordinal": 10
      },
      {
        "name": "date_of_birth",
        "type": "DATETIME",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": true,
        "ordinal": 11
      },
      {
        "name": "phone",
        "type": "VARCHAR(20)",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": true,
        "ordinal": 12
      },
      {
        "name": "phone_verified_at",
        "type": "DATETIME",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": true,
        "ordinal": 13
      },
      {
        "name": "phone_otp_hash",
        "type": "VARCHAR(64)",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": true,
        "ordinal": 14
      },
      {
        "name": "phone_otp_expires_at",
        "type": "DATETIME",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": true,
        "ordinal": 15
      },
      {
        "name": "totp_secret",
        "type": "VARCHAR(64)",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": true,
        "ordinal": 16
      },
      {
        "name": "totp_enabled",
        "type": "BOOLEAN",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": false,
        "ordinal": 17
      },
      {
        "name": "require_password_reset",
        "type": "BOOLEAN",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": false,
        "ordinal": 18
      },
      {
        "name": "created_date",
        "type": "DATETIME",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": false,
        "ordinal": 19
      },
      {
        "name": "updated_at",
        "type": "DATETIME",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": false,
        "ordinal": 20
      },
      {
        "name": "deleted_at",
        "type": "DATETIME",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": true,
        "ordinal": 21
      },
      {
        "name": "banned_at",
        "type": "DATETIME",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": true,
        "ordinal": 22
      },
      {
        "name": "banned_reason",
        "type": "VARCHAR(120)",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": true,
        "ordinal": 23
      }
    ]
  },
  {
    "table": "user_stats",
    "fields": [
      {
        "name": "user_id",
        "type": "INT",
        "pk": true,
        "fk": {
          "table": "users",
          "column": "user_id"
        },
        "unique": false,
        "nullable": false,
        "ordinal": 1
      },
      {
        "name": "buyer_level",
        "type": "INT",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": false,
        "ordinal": 2
      },
      {
        "name": "seller_level",
        "type": "INT",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": false,
        "ordinal": 3
      },
      {
        "name": "role",
        "type": "USERROLE",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": false,
        "ordinal": 4
      },
      {
        "name": "updated_at",
        "type": "DATETIME",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": false,
        "ordinal": 5
      }
    ]
  },
  {
    "table": "business_type",
    "fields": [
      {
        "name": "type_id",
        "type": "INT",
        "pk": true,
        "fk": null,
        "unique": false,
        "nullable": false,
        "ordinal": 1
      },
      {
        "name": "name",
        "type": "VARCHAR(30)",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": false,
        "ordinal": 2
      },
      {
        "name": "description",
        "type": "VARCHAR(150)",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": false,
        "ordinal": 3
      }
    ]
  },
  {
    "table": "store",
    "fields": [
      {
        "name": "store_id",
        "type": "INT",
        "pk": true,
        "fk": null,
        "unique": false,
        "nullable": false,
        "ordinal": 1
      },
      {
        "name": "owner_id",
        "type": "INT",
        "pk": false,
        "fk": {
          "table": "users",
          "column": "user_id"
        },
        "unique": true,
        "nullable": false,
        "ordinal": 2
      },
      {
        "name": "business_type_id",
        "type": "INT",
        "pk": false,
        "fk": {
          "table": "business_type",
          "column": "type_id"
        },
        "unique": false,
        "nullable": false,
        "ordinal": 3
      },
      {
        "name": "name",
        "type": "VARCHAR(60)",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": false,
        "ordinal": 4
      },
      {
        "name": "description",
        "type": "VARCHAR(255)",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": false,
        "ordinal": 5
      },
      {
        "name": "profile_image",
        "type": "TEXT",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": true,
        "ordinal": 6
      },
      {
        "name": "cover_image",
        "type": "TEXT",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": true,
        "ordinal": 7
      },
      {
        "name": "created_at",
        "type": "DATETIME",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": false,
        "ordinal": 8
      },
      {
        "name": "deleted_at",
        "type": "DATETIME",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": true,
        "ordinal": 9
      },
      {
        "name": "suspended_at",
        "type": "DATETIME",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": true,
        "ordinal": 10
      },
      {
        "name": "stripe_account_id",
        "type": "VARCHAR(40)",
        "pk": false,
        "fk": null,
        "unique": true,
        "nullable": true,
        "ordinal": 11
      },
      {
        "name": "stripe_payouts_enabled",
        "type": "BOOLEAN",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": false,
        "ordinal": 12
      },
      {
        "name": "stripe_charges_enabled",
        "type": "BOOLEAN",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": false,
        "ordinal": 13
      },
      {
        "name": "contact_email",
        "type": "VARCHAR(120)",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": true,
        "ordinal": 14
      },
      {
        "name": "phone",
        "type": "VARCHAR(20)",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": true,
        "ordinal": 15
      }
    ]
  },
  {
    "table": "store_stats",
    "fields": [
      {
        "name": "stat_id",
        "type": "INT",
        "pk": true,
        "fk": null,
        "unique": false,
        "nullable": false,
        "ordinal": 1
      },
      {
        "name": "store_id",
        "type": "INT",
        "pk": false,
        "fk": {
          "table": "store",
          "column": "store_id"
        },
        "unique": true,
        "nullable": false,
        "ordinal": 2
      },
      {
        "name": "ctr",
        "type": "INT",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": false,
        "ordinal": 3
      },
      {
        "name": "rating",
        "type": "INT",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": false,
        "ordinal": 4
      },
      {
        "name": "response_time",
        "type": "INT",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": false,
        "ordinal": 5
      },
      {
        "name": "updated_at",
        "type": "DATETIME",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": false,
        "ordinal": 6
      }
    ]
  },
  {
    "table": "category",
    "fields": [
      {
        "name": "category_id",
        "type": "INT",
        "pk": true,
        "fk": null,
        "unique": false,
        "nullable": false,
        "ordinal": 1
      },
      {
        "name": "category_name",
        "type": "VARCHAR(40)",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": false,
        "ordinal": 2
      },
      {
        "name": "description",
        "type": "VARCHAR(150)",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": false,
        "ordinal": 3
      }
    ]
  },
  {
    "table": "product_tag",
    "fields": [
      {
        "name": "tag_id",
        "type": "INT",
        "pk": true,
        "fk": null,
        "unique": false,
        "nullable": false,
        "ordinal": 1
      },
      {
        "name": "tag_name",
        "type": "VARCHAR(30)",
        "pk": false,
        "fk": null,
        "unique": true,
        "nullable": false,
        "ordinal": 2
      },
      {
        "name": "tag_description",
        "type": "VARCHAR(150)",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": false,
        "ordinal": 3
      }
    ]
  },
  {
    "table": "product",
    "fields": [
      {
        "name": "product_id",
        "type": "INT",
        "pk": true,
        "fk": null,
        "unique": false,
        "nullable": false,
        "ordinal": 1
      },
      {
        "name": "store_id",
        "type": "INT",
        "pk": false,
        "fk": {
          "table": "store",
          "column": "store_id"
        },
        "unique": false,
        "nullable": false,
        "ordinal": 2
      },
      {
        "name": "category_id",
        "type": "INT",
        "pk": false,
        "fk": {
          "table": "category",
          "column": "category_id"
        },
        "unique": false,
        "nullable": false,
        "ordinal": 3
      },
      {
        "name": "name",
        "type": "VARCHAR(100)",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": false,
        "ordinal": 4
      },
      {
        "name": "description",
        "type": "VARCHAR(255)",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": false,
        "ordinal": 5
      },
      {
        "name": "is_active",
        "type": "BOOLEAN",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": false,
        "ordinal": 6
      },
      {
        "name": "delivery_method",
        "type": "DELIVERYMETHOD",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": false,
        "ordinal": 7
      },
      {
        "name": "is_stackable",
        "type": "BOOLEAN",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": false,
        "ordinal": 8
      },
      {
        "name": "deleted_at",
        "type": "DATETIME",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": true,
        "ordinal": 9
      },
      {
        "name": "created_at",
        "type": "DATETIME",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": false,
        "ordinal": 10
      },
      {
        "name": "updated_at",
        "type": "DATETIME",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": false,
        "ordinal": 11
      }
    ]
  },
  {
    "table": "product_detail",
    "fields": [
      {
        "name": "product_detail_id",
        "type": "INT",
        "pk": true,
        "fk": null,
        "unique": false,
        "nullable": false,
        "ordinal": 1
      },
      {
        "name": "product_id",
        "type": "INT",
        "pk": false,
        "fk": {
          "table": "product",
          "column": "product_id"
        },
        "unique": false,
        "nullable": false,
        "ordinal": 2
      },
      {
        "name": "detail_name",
        "type": "VARCHAR(80)",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": false,
        "ordinal": 3
      },
      {
        "name": "detail_value",
        "type": "VARCHAR(255)",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": false,
        "ordinal": 4
      }
    ]
  },
  {
    "table": "product_item",
    "fields": [
      {
        "name": "product_item_id",
        "type": "INT",
        "pk": true,
        "fk": null,
        "unique": false,
        "nullable": false,
        "ordinal": 1
      },
      {
        "name": "product_id",
        "type": "INT",
        "pk": false,
        "fk": {
          "table": "product",
          "column": "product_id"
        },
        "unique": false,
        "nullable": false,
        "ordinal": 2
      },
      {
        "name": "name",
        "type": "VARCHAR(100)",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": false,
        "ordinal": 3
      },
      {
        "name": "description",
        "type": "VARCHAR(255)",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": true,
        "ordinal": 4
      },
      {
        "name": "image",
        "type": "TEXT",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": true,
        "ordinal": 5
      },
      {
        "name": "delivery_method",
        "type": "DELIVERYMETHOD",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": false,
        "ordinal": 6
      },
      {
        "name": "quantity",
        "type": "INT",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": false,
        "ordinal": 7
      },
      {
        "name": "price",
        "type": "DECIMAL(10, 2)",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": false,
        "ordinal": 8
      },
      {
        "name": "discount_percent",
        "type": "INT",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": false,
        "ordinal": 9
      },
      {
        "name": "discount_amount",
        "type": "DECIMAL(10, 2)",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": false,
        "ordinal": 10
      },
      {
        "name": "sample_url",
        "type": "TEXT",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": true,
        "ordinal": 11
      },
      {
        "name": "delivery_url",
        "type": "TEXT",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": true,
        "ordinal": 12
      },
      {
        "name": "license_key_template",
        "type": "VARCHAR(80)",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": true,
        "ordinal": 13
      },
      {
        "name": "created_date",
        "type": "DATETIME",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": false,
        "ordinal": 14
      }
    ]
  },
  {
    "table": "product_image",
    "fields": [
      {
        "name": "product_image_id",
        "type": "INT",
        "pk": true,
        "fk": null,
        "unique": false,
        "nullable": false,
        "ordinal": 1
      },
      {
        "name": "product_id",
        "type": "INT",
        "pk": false,
        "fk": {
          "table": "product",
          "column": "product_id"
        },
        "unique": false,
        "nullable": false,
        "ordinal": 2
      },
      {
        "name": "product_image",
        "type": "TEXT",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": false,
        "ordinal": 3
      },
      {
        "name": "sort_order",
        "type": "INT",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": false,
        "ordinal": 4
      }
    ]
  },
  {
    "table": "product_review",
    "fields": [
      {
        "name": "review_id",
        "type": "INT",
        "pk": true,
        "fk": null,
        "unique": false,
        "nullable": false,
        "ordinal": 1
      },
      {
        "name": "product_id",
        "type": "INT",
        "pk": false,
        "fk": {
          "table": "product",
          "column": "product_id"
        },
        "unique": false,
        "nullable": false,
        "ordinal": 2
      },
      {
        "name": "user_id",
        "type": "INT",
        "pk": false,
        "fk": {
          "table": "users",
          "column": "user_id"
        },
        "unique": false,
        "nullable": false,
        "ordinal": 3
      },
      {
        "name": "rating",
        "type": "INT",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": false,
        "ordinal": 4
      },
      {
        "name": "comment",
        "type": "VARCHAR(255)",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": false,
        "ordinal": 5
      },
      {
        "name": "created_at",
        "type": "DATETIME",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": false,
        "ordinal": 6
      }
    ]
  },
  {
    "table": "product_n_tag",
    "fields": [
      {
        "name": "junction_id",
        "type": "INT",
        "pk": true,
        "fk": null,
        "unique": false,
        "nullable": false,
        "ordinal": 1
      },
      {
        "name": "product_id",
        "type": "INT",
        "pk": false,
        "fk": {
          "table": "product",
          "column": "product_id"
        },
        "unique": false,
        "nullable": false,
        "ordinal": 2
      },
      {
        "name": "tag_id",
        "type": "INT",
        "pk": false,
        "fk": {
          "table": "product_tag",
          "column": "tag_id"
        },
        "unique": false,
        "nullable": false,
        "ordinal": 3
      }
    ]
  },
  {
    "table": "product_favorite",
    "fields": [
      {
        "name": "favorite_id",
        "type": "INT",
        "pk": true,
        "fk": null,
        "unique": false,
        "nullable": false,
        "ordinal": 1
      },
      {
        "name": "user_id",
        "type": "INT",
        "pk": false,
        "fk": {
          "table": "users",
          "column": "user_id"
        },
        "unique": false,
        "nullable": false,
        "ordinal": 2
      },
      {
        "name": "product_id",
        "type": "INT",
        "pk": false,
        "fk": {
          "table": "product",
          "column": "product_id"
        },
        "unique": false,
        "nullable": false,
        "ordinal": 3
      },
      {
        "name": "created_at",
        "type": "DATETIME",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": false,
        "ordinal": 4
      }
    ]
  },
  {
    "table": "cart",
    "fields": [
      {
        "name": "cart_id",
        "type": "INT",
        "pk": true,
        "fk": null,
        "unique": false,
        "nullable": false,
        "ordinal": 1
      },
      {
        "name": "user_id",
        "type": "INT",
        "pk": false,
        "fk": {
          "table": "users",
          "column": "user_id"
        },
        "unique": false,
        "nullable": false,
        "ordinal": 2
      },
      {
        "name": "status",
        "type": "CARTSTATUS",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": false,
        "ordinal": 3
      },
      {
        "name": "created_at",
        "type": "DATETIME",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": false,
        "ordinal": 4
      },
      {
        "name": "updated_at",
        "type": "DATETIME",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": false,
        "ordinal": 5
      },
      {
        "name": "expired_at",
        "type": "DATETIME",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": true,
        "ordinal": 6
      },
      {
        "name": "session_id",
        "type": "INT",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": true,
        "ordinal": 7
      }
    ]
  },
  {
    "table": "cart_item",
    "fields": [
      {
        "name": "cart_item_id",
        "type": "INT",
        "pk": true,
        "fk": null,
        "unique": false,
        "nullable": false,
        "ordinal": 1
      },
      {
        "name": "cart_id",
        "type": "INT",
        "pk": false,
        "fk": {
          "table": "cart",
          "column": "cart_id"
        },
        "unique": false,
        "nullable": false,
        "ordinal": 2
      },
      {
        "name": "product_item_id",
        "type": "INT",
        "pk": false,
        "fk": {
          "table": "product_item",
          "column": "product_item_id"
        },
        "unique": false,
        "nullable": false,
        "ordinal": 3
      },
      {
        "name": "quantity",
        "type": "INT",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": false,
        "ordinal": 4
      },
      {
        "name": "created_at",
        "type": "DATETIME",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": false,
        "ordinal": 5
      }
    ]
  },
  {
    "table": "transactions",
    "fields": [
      {
        "name": "transaction_id",
        "type": "INT",
        "pk": true,
        "fk": null,
        "unique": false,
        "nullable": false,
        "ordinal": 1
      },
      {
        "name": "transaction_type",
        "type": "TRANSACTIONTYPE",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": false,
        "ordinal": 2
      },
      {
        "name": "user_id",
        "type": "INT",
        "pk": false,
        "fk": {
          "table": "users",
          "column": "user_id"
        },
        "unique": false,
        "nullable": false,
        "ordinal": 3
      },
      {
        "name": "total_amount",
        "type": "DECIMAL(12, 2)",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": false,
        "ordinal": 4
      },
      {
        "name": "date",
        "type": "DATETIME",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": false,
        "ordinal": 5
      },
      {
        "name": "created_at",
        "type": "DATETIME",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": false,
        "ordinal": 6
      }
    ]
  },
  {
    "table": "orders",
    "fields": [
      {
        "name": "order_id",
        "type": "INT",
        "pk": true,
        "fk": null,
        "unique": false,
        "nullable": false,
        "ordinal": 1
      },
      {
        "name": "cart_id",
        "type": "INT",
        "pk": false,
        "fk": {
          "table": "cart",
          "column": "cart_id"
        },
        "unique": true,
        "nullable": false,
        "ordinal": 2
      },
      {
        "name": "user_id",
        "type": "INT",
        "pk": false,
        "fk": {
          "table": "users",
          "column": "user_id"
        },
        "unique": false,
        "nullable": false,
        "ordinal": 3
      },
      {
        "name": "total_price",
        "type": "DECIMAL(12, 2)",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": false,
        "ordinal": 4
      },
      {
        "name": "status",
        "type": "ORDERSTATUS",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": false,
        "ordinal": 5
      },
      {
        "name": "transaction_id",
        "type": "INT",
        "pk": false,
        "fk": {
          "table": "transactions",
          "column": "transaction_id"
        },
        "unique": false,
        "nullable": true,
        "ordinal": 6
      },
      {
        "name": "created_at",
        "type": "DATETIME",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": false,
        "ordinal": 7
      },
      {
        "name": "updated_at",
        "type": "DATETIME",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": false,
        "ordinal": 8
      },
      {
        "name": "expired_at",
        "type": "DATETIME",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": true,
        "ordinal": 9
      },
      {
        "name": "gift_recipient_email",
        "type": "VARCHAR(80)",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": true,
        "ordinal": 10
      },
      {
        "name": "gift_message",
        "type": "VARCHAR(500)",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": true,
        "ordinal": 11
      },
      {
        "name": "stripe_payment_intent_id",
        "type": "VARCHAR(40)",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": true,
        "ordinal": 12
      },
      {
        "name": "stripe_charge_id",
        "type": "VARCHAR(40)",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": true,
        "ordinal": 13
      },
      {
        "name": "stripe_refund_id",
        "type": "VARCHAR(40)",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": true,
        "ordinal": 14
      },
      {
        "name": "stripe_amount_received",
        "type": "INT",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": true,
        "ordinal": 15
      },
      {
        "name": "stripe_amount_refunded",
        "type": "INT",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": false,
        "ordinal": 16
      }
    ]
  },
  {
    "table": "order_item",
    "fields": [
      {
        "name": "order_item_id",
        "type": "INT",
        "pk": true,
        "fk": null,
        "unique": false,
        "nullable": false,
        "ordinal": 1
      },
      {
        "name": "order_id",
        "type": "INT",
        "pk": false,
        "fk": {
          "table": "orders",
          "column": "order_id"
        },
        "unique": false,
        "nullable": false,
        "ordinal": 2
      },
      {
        "name": "product_item_id",
        "type": "INT",
        "pk": false,
        "fk": {
          "table": "product_item",
          "column": "product_item_id"
        },
        "unique": false,
        "nullable": false,
        "ordinal": 3
      },
      {
        "name": "coupon_id",
        "type": "INT",
        "pk": false,
        "fk": {
          "table": "coupon",
          "column": "coupon_id"
        },
        "unique": false,
        "nullable": true,
        "ordinal": 4
      },
      {
        "name": "quantity",
        "type": "INT",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": false,
        "ordinal": 5
      },
      {
        "name": "price_per_unit",
        "type": "DECIMAL(12, 2)",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": false,
        "ordinal": 6
      },
      {
        "name": "delivered_url",
        "type": "TEXT",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": true,
        "ordinal": 7
      },
      {
        "name": "delivered_key",
        "type": "VARCHAR(80)",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": true,
        "ordinal": 8
      },
      {
        "name": "delivered_at",
        "type": "DATETIME",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": true,
        "ordinal": 9
      }
    ]
  },
  {
    "table": "coupon",
    "fields": [
      {
        "name": "coupon_id",
        "type": "INT",
        "pk": true,
        "fk": null,
        "unique": false,
        "nullable": false,
        "ordinal": 1
      },
      {
        "name": "store_id",
        "type": "INT",
        "pk": false,
        "fk": {
          "table": "store",
          "column": "store_id"
        },
        "unique": false,
        "nullable": true,
        "ordinal": 2
      },
      {
        "name": "code",
        "type": "VARCHAR(50)",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": false,
        "ordinal": 3
      },
      {
        "name": "start_date",
        "type": "DATETIME",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": false,
        "ordinal": 4
      },
      {
        "name": "end_date",
        "type": "DATETIME",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": false,
        "ordinal": 5
      },
      {
        "name": "usage_limit",
        "type": "INT",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": false,
        "ordinal": 6
      },
      {
        "name": "discount_type",
        "type": "DISCOUNTTYPE",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": false,
        "ordinal": 7
      },
      {
        "name": "discount_value",
        "type": "INT",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": false,
        "ordinal": 8
      },
      {
        "name": "is_active",
        "type": "BOOLEAN",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": false,
        "ordinal": 9
      }
    ]
  },
  {
    "table": "coupon_usage",
    "fields": [
      {
        "name": "usage_id",
        "type": "INT",
        "pk": true,
        "fk": null,
        "unique": false,
        "nullable": false,
        "ordinal": 1
      },
      {
        "name": "coupon_id",
        "type": "INT",
        "pk": false,
        "fk": {
          "table": "coupon",
          "column": "coupon_id"
        },
        "unique": false,
        "nullable": false,
        "ordinal": 2
      },
      {
        "name": "user_id",
        "type": "INT",
        "pk": false,
        "fk": {
          "table": "users",
          "column": "user_id"
        },
        "unique": false,
        "nullable": false,
        "ordinal": 3
      },
      {
        "name": "created_at",
        "type": "DATETIME",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": false,
        "ordinal": 4
      }
    ]
  },
  {
    "table": "password_reset_token",
    "fields": [
      {
        "name": "token_id",
        "type": "INT",
        "pk": true,
        "fk": null,
        "unique": false,
        "nullable": false,
        "ordinal": 1
      },
      {
        "name": "user_id",
        "type": "INT",
        "pk": false,
        "fk": {
          "table": "users",
          "column": "user_id"
        },
        "unique": false,
        "nullable": false,
        "ordinal": 2
      },
      {
        "name": "token_hash",
        "type": "VARCHAR(64)",
        "pk": false,
        "fk": null,
        "unique": true,
        "nullable": false,
        "ordinal": 3
      },
      {
        "name": "expires_at",
        "type": "DATETIME",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": false,
        "ordinal": 4
      },
      {
        "name": "consumed_at",
        "type": "DATETIME",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": true,
        "ordinal": 5
      },
      {
        "name": "created_at",
        "type": "DATETIME",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": false,
        "ordinal": 6
      }
    ]
  },
  {
    "table": "email_verify_token",
    "fields": [
      {
        "name": "token_id",
        "type": "INT",
        "pk": true,
        "fk": null,
        "unique": false,
        "nullable": false,
        "ordinal": 1
      },
      {
        "name": "user_id",
        "type": "INT",
        "pk": false,
        "fk": {
          "table": "users",
          "column": "user_id"
        },
        "unique": false,
        "nullable": false,
        "ordinal": 2
      },
      {
        "name": "token_hash",
        "type": "VARCHAR(64)",
        "pk": false,
        "fk": null,
        "unique": true,
        "nullable": false,
        "ordinal": 3
      },
      {
        "name": "expires_at",
        "type": "DATETIME",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": false,
        "ordinal": 4
      },
      {
        "name": "consumed_at",
        "type": "DATETIME",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": true,
        "ordinal": 5
      },
      {
        "name": "created_at",
        "type": "DATETIME",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": false,
        "ordinal": 6
      }
    ]
  },
  {
    "table": "audit_log",
    "fields": [
      {
        "name": "log_id",
        "type": "INT",
        "pk": true,
        "fk": null,
        "unique": false,
        "nullable": false,
        "ordinal": 1
      },
      {
        "name": "actor_id",
        "type": "INT",
        "pk": false,
        "fk": {
          "table": "users",
          "column": "user_id"
        },
        "unique": false,
        "nullable": true,
        "ordinal": 2
      },
      {
        "name": "action",
        "type": "VARCHAR(60)",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": false,
        "ordinal": 3
      },
      {
        "name": "target_type",
        "type": "VARCHAR(40)",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": false,
        "ordinal": 4
      },
      {
        "name": "target_id",
        "type": "INT",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": false,
        "ordinal": 5
      },
      {
        "name": "meta",
        "type": "JSONB",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": true,
        "ordinal": 6
      },
      {
        "name": "ip_address",
        "type": "VARCHAR(45)",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": true,
        "ordinal": 7
      },
      {
        "name": "user_agent",
        "type": "VARCHAR(255)",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": true,
        "ordinal": 8
      },
      {
        "name": "created_at",
        "type": "DATETIME",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": false,
        "ordinal": 9
      }
    ]
  },
  {
    "table": "account",
    "fields": [
      {
        "name": "id",
        "type": "INT",
        "pk": true,
        "fk": null,
        "unique": false,
        "nullable": false,
        "ordinal": 1
      },
      {
        "name": "user_id",
        "type": "INT",
        "pk": false,
        "fk": {
          "table": "users",
          "column": "user_id"
        },
        "unique": false,
        "nullable": false,
        "ordinal": 2
      },
      {
        "name": "provider_id",
        "type": "VARCHAR(40)",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": false,
        "ordinal": 3
      },
      {
        "name": "account_id",
        "type": "VARCHAR(255)",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": false,
        "ordinal": 4
      },
      {
        "name": "access_token",
        "type": "TEXT",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": true,
        "ordinal": 5
      },
      {
        "name": "refresh_token",
        "type": "TEXT",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": true,
        "ordinal": 6
      },
      {
        "name": "access_token_expires_at",
        "type": "DATETIME",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": true,
        "ordinal": 7
      },
      {
        "name": "refresh_token_expires_at",
        "type": "DATETIME",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": true,
        "ordinal": 8
      },
      {
        "name": "scope",
        "type": "VARCHAR(255)",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": true,
        "ordinal": 9
      },
      {
        "name": "id_token",
        "type": "TEXT",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": true,
        "ordinal": 10
      },
      {
        "name": "password",
        "type": "TEXT",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": true,
        "ordinal": 11
      },
      {
        "name": "created_at",
        "type": "DATETIME",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": false,
        "ordinal": 12
      },
      {
        "name": "updated_at",
        "type": "DATETIME",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": false,
        "ordinal": 13
      }
    ]
  },
  {
    "table": "session",
    "fields": [
      {
        "name": "id",
        "type": "INT",
        "pk": true,
        "fk": null,
        "unique": false,
        "nullable": false,
        "ordinal": 1
      },
      {
        "name": "user_id",
        "type": "INT",
        "pk": false,
        "fk": {
          "table": "users",
          "column": "user_id"
        },
        "unique": false,
        "nullable": false,
        "ordinal": 2
      },
      {
        "name": "token",
        "type": "VARCHAR(120)",
        "pk": false,
        "fk": null,
        "unique": true,
        "nullable": false,
        "ordinal": 3
      },
      {
        "name": "expires_at",
        "type": "DATETIME",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": false,
        "ordinal": 4
      },
      {
        "name": "ip_address",
        "type": "VARCHAR(45)",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": true,
        "ordinal": 5
      },
      {
        "name": "user_agent",
        "type": "VARCHAR(255)",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": true,
        "ordinal": 6
      },
      {
        "name": "created_at",
        "type": "DATETIME",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": false,
        "ordinal": 7
      },
      {
        "name": "updated_at",
        "type": "DATETIME",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": false,
        "ordinal": 8
      },
      {
        "name": "last_totp_at",
        "type": "DATETIME",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": true,
        "ordinal": 9
      }
    ]
  },
  {
    "table": "verification",
    "fields": [
      {
        "name": "id",
        "type": "INT",
        "pk": true,
        "fk": null,
        "unique": false,
        "nullable": false,
        "ordinal": 1
      },
      {
        "name": "identifier",
        "type": "VARCHAR(120)",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": false,
        "ordinal": 2
      },
      {
        "name": "value",
        "type": "TEXT",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": false,
        "ordinal": 3
      },
      {
        "name": "expires_at",
        "type": "DATETIME",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": false,
        "ordinal": 4
      },
      {
        "name": "created_at",
        "type": "DATETIME",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": false,
        "ordinal": 5
      },
      {
        "name": "updated_at",
        "type": "DATETIME",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": false,
        "ordinal": 6
      }
    ]
  },
  {
    "table": "system_setting",
    "fields": [
      {
        "name": "id",
        "type": "INT",
        "pk": true,
        "fk": null,
        "unique": false,
        "nullable": false,
        "ordinal": 1
      },
      {
        "name": "favorites_enabled",
        "type": "BOOLEAN",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": false,
        "ordinal": 2
      },
      {
        "name": "platform_fee_percent",
        "type": "DECIMAL(5, 2)",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": false,
        "ordinal": 3
      },
      {
        "name": "updated_at",
        "type": "DATETIME",
        "pk": false,
        "fk": null,
        "unique": false,
        "nullable": false,
        "ordinal": 4
      }
    ]
  }
];

export const ER_RELATIONSHIPS: ErRelationship[] = [
  {
    "from": "users",
    "fromColumn": "country_id",
    "to": "country",
    "toColumn": "country_id",
    "cardinality": "one-to-many",
    "fromOptional": true
  },
  {
    "from": "user_stats",
    "fromColumn": "user_id",
    "to": "users",
    "toColumn": "user_id",
    "cardinality": "one-to-one",
    "fromOptional": false
  },
  {
    "from": "store",
    "fromColumn": "owner_id",
    "to": "users",
    "toColumn": "user_id",
    "cardinality": "one-to-one",
    "fromOptional": false
  },
  {
    "from": "store",
    "fromColumn": "business_type_id",
    "to": "business_type",
    "toColumn": "type_id",
    "cardinality": "one-to-many",
    "fromOptional": false
  },
  {
    "from": "store_stats",
    "fromColumn": "store_id",
    "to": "store",
    "toColumn": "store_id",
    "cardinality": "one-to-one",
    "fromOptional": false
  },
  {
    "from": "product",
    "fromColumn": "store_id",
    "to": "store",
    "toColumn": "store_id",
    "cardinality": "one-to-many",
    "fromOptional": false
  },
  {
    "from": "product",
    "fromColumn": "category_id",
    "to": "category",
    "toColumn": "category_id",
    "cardinality": "one-to-many",
    "fromOptional": false
  },
  {
    "from": "product_detail",
    "fromColumn": "product_id",
    "to": "product",
    "toColumn": "product_id",
    "cardinality": "one-to-many",
    "fromOptional": false
  },
  {
    "from": "product_item",
    "fromColumn": "product_id",
    "to": "product",
    "toColumn": "product_id",
    "cardinality": "one-to-many",
    "fromOptional": false
  },
  {
    "from": "product_image",
    "fromColumn": "product_id",
    "to": "product",
    "toColumn": "product_id",
    "cardinality": "one-to-many",
    "fromOptional": false
  },
  {
    "from": "product_review",
    "fromColumn": "product_id",
    "to": "product",
    "toColumn": "product_id",
    "cardinality": "one-to-many",
    "fromOptional": false
  },
  {
    "from": "product_review",
    "fromColumn": "user_id",
    "to": "users",
    "toColumn": "user_id",
    "cardinality": "one-to-many",
    "fromOptional": false
  },
  {
    "from": "product_n_tag",
    "fromColumn": "product_id",
    "to": "product",
    "toColumn": "product_id",
    "cardinality": "one-to-many",
    "fromOptional": false
  },
  {
    "from": "product_n_tag",
    "fromColumn": "tag_id",
    "to": "product_tag",
    "toColumn": "tag_id",
    "cardinality": "one-to-many",
    "fromOptional": false
  },
  {
    "from": "product_favorite",
    "fromColumn": "user_id",
    "to": "users",
    "toColumn": "user_id",
    "cardinality": "one-to-many",
    "fromOptional": false
  },
  {
    "from": "product_favorite",
    "fromColumn": "product_id",
    "to": "product",
    "toColumn": "product_id",
    "cardinality": "one-to-many",
    "fromOptional": false
  },
  {
    "from": "cart",
    "fromColumn": "user_id",
    "to": "users",
    "toColumn": "user_id",
    "cardinality": "one-to-many",
    "fromOptional": false
  },
  {
    "from": "cart_item",
    "fromColumn": "cart_id",
    "to": "cart",
    "toColumn": "cart_id",
    "cardinality": "one-to-many",
    "fromOptional": false
  },
  {
    "from": "cart_item",
    "fromColumn": "product_item_id",
    "to": "product_item",
    "toColumn": "product_item_id",
    "cardinality": "one-to-many",
    "fromOptional": false
  },
  {
    "from": "transactions",
    "fromColumn": "user_id",
    "to": "users",
    "toColumn": "user_id",
    "cardinality": "one-to-many",
    "fromOptional": false
  },
  {
    "from": "orders",
    "fromColumn": "cart_id",
    "to": "cart",
    "toColumn": "cart_id",
    "cardinality": "one-to-one",
    "fromOptional": false
  },
  {
    "from": "orders",
    "fromColumn": "user_id",
    "to": "users",
    "toColumn": "user_id",
    "cardinality": "one-to-many",
    "fromOptional": false
  },
  {
    "from": "orders",
    "fromColumn": "transaction_id",
    "to": "transactions",
    "toColumn": "transaction_id",
    "cardinality": "one-to-many",
    "fromOptional": true
  },
  {
    "from": "order_item",
    "fromColumn": "order_id",
    "to": "orders",
    "toColumn": "order_id",
    "cardinality": "one-to-many",
    "fromOptional": false
  },
  {
    "from": "order_item",
    "fromColumn": "product_item_id",
    "to": "product_item",
    "toColumn": "product_item_id",
    "cardinality": "one-to-many",
    "fromOptional": false
  },
  {
    "from": "order_item",
    "fromColumn": "coupon_id",
    "to": "coupon",
    "toColumn": "coupon_id",
    "cardinality": "one-to-many",
    "fromOptional": true
  },
  {
    "from": "coupon",
    "fromColumn": "store_id",
    "to": "store",
    "toColumn": "store_id",
    "cardinality": "one-to-many",
    "fromOptional": true
  },
  {
    "from": "coupon_usage",
    "fromColumn": "coupon_id",
    "to": "coupon",
    "toColumn": "coupon_id",
    "cardinality": "one-to-many",
    "fromOptional": false
  },
  {
    "from": "coupon_usage",
    "fromColumn": "user_id",
    "to": "users",
    "toColumn": "user_id",
    "cardinality": "one-to-many",
    "fromOptional": false
  },
  {
    "from": "password_reset_token",
    "fromColumn": "user_id",
    "to": "users",
    "toColumn": "user_id",
    "cardinality": "one-to-many",
    "fromOptional": false
  },
  {
    "from": "email_verify_token",
    "fromColumn": "user_id",
    "to": "users",
    "toColumn": "user_id",
    "cardinality": "one-to-many",
    "fromOptional": false
  },
  {
    "from": "audit_log",
    "fromColumn": "actor_id",
    "to": "users",
    "toColumn": "user_id",
    "cardinality": "one-to-many",
    "fromOptional": true
  },
  {
    "from": "account",
    "fromColumn": "user_id",
    "to": "users",
    "toColumn": "user_id",
    "cardinality": "one-to-many",
    "fromOptional": false
  },
  {
    "from": "session",
    "fromColumn": "user_id",
    "to": "users",
    "toColumn": "user_id",
    "cardinality": "one-to-many",
    "fromOptional": false
  }
];
