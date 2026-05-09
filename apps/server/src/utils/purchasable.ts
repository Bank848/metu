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
  /** Variant stock (`product_item.quantity`). Caps non-digital lines. */
  stock: number;
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
  /** True for download/email/license_key/streaming — caps quantity at 1. */
  isDigital: boolean;
  /** Effective quantity ceiling: 1 for digital, `stock` otherwise. */
  quantityCap: number;
}

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
  const quantityCap = isDigital ? 1 : Math.max(0, row.quantity);

  return {
    productItemId: row.productItemId,
    deliveryMethod: row.deliveryMethod,
    stock: row.quantity,
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
 * Cap desired qty: digital → 1, physical → stock. Returns >= 1.
 */
export function capQuantity(
  desired: number,
  item: Pick<PurchasableProductItem, "isDigital" | "stock">,
): number {
  const ceiling = item.isDigital ? 1 : Math.max(1, item.stock);
  return Math.max(1, Math.min(desired, ceiling));
}
