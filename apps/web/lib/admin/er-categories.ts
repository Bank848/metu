/**
 * Phase 24 — manual table → category map + per-category style.
 *
 * Each table is grouped into a category whose color matches the
 * Lucidchart palette in the friend's CPE241 report PDF (see Phase 25
 * docx). Header colors are picked to mirror that visual so a side-by-
 * side comparison reads as the same project, just at different
 * versions.
 *
 * When adding a new table to schema.prisma:
 *   1. Run `node scripts/generate-er-schema.mjs` to refresh er-schema.ts
 *   2. Add an entry here mapping the new table to a category
 *   3. (Optional) tweak `CATEGORY_STYLE` if the palette needs a new colour
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
  /** Header background colour (hex, applied to entity card top bar). */
  headerBg: string;
  /** Header text colour — pick "white" or "black" per WCAG contrast. */
  headerText: "white" | "black";
  /** Display label for the legend. */
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

/**
 * Table-name → category. Tables not in this map fall back to "system"
 * so the diagram never breaks on a fresh entity — the maintainer just
 * gets a gray header until they classify it properly.
 */
export const ENTITY_CATEGORY: Record<string, ErCategory> = {
  // Identity & Auth (Phase 13.2, 14-16, 23.x)
  users: "identity",
  user_stats: "identity",
  country: "identity",
  account: "identity",
  session: "identity",
  verification: "identity",
  password_reset_token: "identity",

  // Store (Phase 12-13)
  store: "store",
  store_stats: "store",
  business_type: "store",

  // Catalog (Phase 13.7-13.8, 17.2)
  category: "catalog",
  product: "catalog",
  product_item: "catalog",
  product_image: "catalog",
  product_review: "catalog",
  product_favorite: "catalog",
  // Phase 26 — product_question + stock_alert removed (messaging surface
  // and stock-alert subscription cut). Earlier entries kept here in
  // git history if anyone needs to re-introduce them.

  // Tag junction (separate slot so the colour isn't drowned by catalog)
  product_n_tag: "tag",
  product_tag: "tag",

  // Cart & Transactions (Phase 13.3)
  cart: "cart",
  cart_item: "cart",
  transactions: "cart",

  // Orders (Phase 13.4)
  orders: "order",
  order_item: "order",

  // Coupons (Phase 13.3)
  coupon: "coupon",
  coupon_usage: "coupon",

  // Payments (Phase 27) — externalised to Stripe ; the schema only
  // holds soft-FK varchar IDs on Order and Store. No dedicated entity
  // belongs in this slot today, but the colour is reserved so a
  // future "stripe_event" or "payout" table lands somewhere obvious.

  // System & audit (Phase 12.2, 17.1)
  system_setting: "system",
  audit_log: "system",
  // Phase 26 — message removed.
};

/** Resolve a table to its category, defaulting to "system". */
export function categoryFor(table: string): ErCategory {
  return ENTITY_CATEGORY[table] ?? "system";
}
