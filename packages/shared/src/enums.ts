// Mirror of Prisma enums so web and api can share literal values without importing @prisma/client.

export const USER_ROLE = ["buyer", "seller", "admin"] as const;
export type UserRole = (typeof USER_ROLE)[number];

export const CART_STATUS = ["active", "checked_out", "expired"] as const;
export type CartStatus = (typeof CART_STATUS)[number];

export const ORDER_STATUS = ["pending", "paid", "fulfilled", "cancelled", "refunded"] as const;
export type OrderStatus = (typeof ORDER_STATUS)[number];

export const TRANSACTION_TYPE = ["purchase", "payout", "refund"] as const;
export type TransactionType = (typeof TRANSACTION_TYPE)[number];

export const DELIVERY_METHOD = ["download", "email", "license_key", "streaming"] as const;
export type DeliveryMethod = (typeof DELIVERY_METHOD)[number];

export const DISCOUNT_TYPE = ["percent", "fixed"] as const;
export type DiscountType = (typeof DISCOUNT_TYPE)[number];

export const GENDER = ["male", "female", "other"] as const;
export type Gender = (typeof GENDER)[number];
