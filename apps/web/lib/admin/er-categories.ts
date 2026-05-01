/**
 * Manual table -> category map for the ER diagram.
 * Adding a new table: run scripts/generate-er-schema.mjs, then add a
 * category entry below.
 */

export type ErCategory =
  | "identity"
  | "store"
  | "catalog"
  | "tag"
  | "cart"
  | "order"
  | "coupon"
  | "payments"
  | "system";

interface CategoryStyle {
  headerBg: string;
  /** "white" or "black" per WCAG contrast. */
  headerText: "white" | "black";
  label: string;
}

export const CATEGORY_STYLE: Record<ErCategory, CategoryStyle> = {
  identity: { headerBg: "#3b82f6", headerText: "white", label: "Identity & Auth" },
  store:    { headerBg: "#f59e0b", headerText: "black", label: "Store" },
  catalog:  { headerBg: "#d8b4fe", headerText: "black", label: "Catalog" },
  tag:      { headerBg: "#fbcfe8", headerText: "black", label: "Tags" },
  cart:     { headerBg: "#f97316", headerText: "white", label: "Cart & Tx" },
  order:    { headerBg: "#34d399", headerText: "black", label: "Orders" },
  coupon:   { headerBg: "#fb7185", headerText: "black", label: "Coupons" },
  payments: { headerBg: "#10b981", headerText: "white", label: "Payments (Stripe)" },
  system:   { headerBg: "#94a3b8", headerText: "white", label: "System & Audit" },
};

// Unmapped tables fall back to "system".
export const ENTITY_CATEGORY: Record<string, ErCategory> = {
  // Identity & Auth
  users: "identity",
  user_stats: "identity",
  country: "identity",
  account: "identity",
  session: "identity",
  verification: "identity",
  password_reset_token: "identity",

  // Store
  store: "store",
  store_stats: "store",
  business_type: "store",

  // Catalog
  category: "catalog",
  product: "catalog",
  product_item: "catalog",
  product_image: "catalog",
  product_review: "catalog",
  product_favorite: "catalog",

  // Tags
  product_n_tag: "tag",
  product_tag: "tag",

  // Cart + Transactions
  cart: "cart",
  cart_item: "cart",
  transactions: "cart",

  // Orders
  orders: "order",
  order_item: "order",

  // Coupons
  coupon: "coupon",
  coupon_usage: "coupon",

  // Payments live in Stripe; schema only holds soft-FK varchar IDs.

  // System
  system_setting: "system",
  audit_log: "system",
};

/** Resolve a table to its category, defaulting to "system". */
export function categoryFor(table: string): ErCategory {
  return ENTITY_CATEGORY[table] ?? "system";
}
