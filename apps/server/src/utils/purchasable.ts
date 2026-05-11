/**
 * Centralised "is this productItem buyable?" gate. Shared by cart
 * addItem / updateItem and checkout so every write path enforces
 * the same availability rules.
 */
import { prisma } from "../db/prisma.js";
import { AppError } from "../utils/errors.js";

export const DIGITAL_DELIVERY = new Set([
  "download",
  "email",
  "license_key",
  "streaming",
]);

export interface PurchasableProductItem {
  productItemId: number;
  deliveryMethod: string;
  /** Variant stock (`product_item.quantity`). Caps non-digital lines.
   *  null in the underlying row = unlimited; we coerce to 0 here for
   *  the ceiling math (a true "out of stock" path triggers OutOfStock
   *  separately). */
  stock: number;
  /** Raw stock from DB — null means unlimited (used for stackable
   *  license keys where we don't want to cap at the coerced 0). */
  stockRaw: number | null;
  product: {
    productId: number;
    name: string;
    isStackable: boolean;
    storeId: number;
    store: {
      ownerId: number;
      stripeChargesEnabled: boolean;
    };
  };
  /** True for download/email/license_key/streaming — caps quantity at 1
   *  unless the variant is license_key + product.isStackable. */
  isDigital: boolean;
  /** Effective quantity ceiling. Default 1 for digital lines, `stock`
   *  for physical. License_key + isStackable lifts the cap to stock
   *  (or 99 when stock is null/unlimited so the buyer can collect
   *  multiple keys without hitting a magic ceiling). */
  quantityCap: number;
}

const STACKABLE_KEY_UNLIMITED_CAP = 99;

/**
 * Resolve a productItemId to a validated, ready-to-purchase row;
 * throws on any blocking state. Caller-specific guards (e.g. owner
 * buys own store) are not enforced here.
 */
export async function loadPurchasableProductItem(
  productItemId: number,
): Promise<PurchasableProductItem> {
  const row = await prisma.productItem.findUnique({
    where: { productItemId },
    select: {
      productItemId: true,
      deliveryMethod: true,
      quantity: true,
      product: {
        select: {
          productId: true,
          name: true,
          isStackable: true,
          isActive: true,
          storeId: true,
          store: {
            select: {
              ownerId: true,
              suspendedAt: true,
              stripeChargesEnabled: true,
            },
          },
        },
      },
    },
  });
  if (!row) {
    throw new AppError(404, "ProductItemNotFound");
  }
  // Match findProducts's where clause so a line that wouldn't surface
  // on /browse can't slip through cart.
  if (!row.product.isActive) {
    throw new AppError(
      409,
      "ProductUnavailable",
      "This product is paused by the seller and can't be purchased right now.",
    );
  }
  if (row.product.store.suspendedAt) {
    throw new AppError(409, "StoreUnavailable", "This store is suspended and can't accept orders.");
  }

  const isDigital = DIGITAL_DELIVERY.has(row.deliveryMethod);
  // ProductItem.quantity is nullable post-PR; null = unlimited stock.
  const stockOrZero = row.quantity ?? 0;
  // Stackable license_key: buyer can grab multiple keys, so the cap
  // is the variant's stock (or STACKABLE_KEY_UNLIMITED_CAP when stock
  // is null/unlimited — a hard ceiling guards against an obvious
  // mistake like 9999 keys in one cart line). Other digital methods
  // stay capped at 1.
  const isStackableKey = row.deliveryMethod === "license_key" && row.product.isStackable;
  const quantityCap = isStackableKey
    ? (row.quantity === null ? STACKABLE_KEY_UNLIMITED_CAP : Math.max(0, stockOrZero))
    : isDigital
      ? 1
      : Math.max(0, stockOrZero);

  return {
    productItemId: row.productItemId,
    deliveryMethod: row.deliveryMethod,
    stock: stockOrZero,
    stockRaw: row.quantity,
    product: {
      productId: row.product.productId,
      name: row.product.name,
      isStackable: row.product.isStackable,
      storeId: row.product.storeId,
      store: {
        ownerId: row.product.store.ownerId,
        stripeChargesEnabled: row.product.store.stripeChargesEnabled,
      },
    },
    isDigital,
    quantityCap,
  };
}

/**
 * Cap desired qty. Uses the pre-computed `quantityCap` when present
 * (loadPurchasableProductItem already accounts for stackable-key
 * variants); falls back to the digital/physical rule for the older
 * call sites that only pass `{ isDigital, stock }`. Returns >= 1.
 */
export function capQuantity(
  desired: number,
  item:
    | Pick<PurchasableProductItem, "quantityCap">
    | Pick<PurchasableProductItem, "isDigital" | "stock">,
): number {
  const cap = (item as { quantityCap?: number }).quantityCap;
  const ceiling = typeof cap === "number"
    ? Math.max(1, cap)
    : (item as { isDigital: boolean }).isDigital
      ? 1
      : Math.max(1, (item as { stock: number }).stock);
  return Math.max(1, Math.min(desired, ceiling));
}
