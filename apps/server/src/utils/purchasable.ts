/**
 * Centralised "is this product item buyable right now?"
 * gate. Used by `cart.service.addItem` + `cart.service.updateItem` +
 * `orders.service.checkout` so every write path enforces the same
 * availability rules. Without this, a buyer who knows a productItemId
 * could:
 *   - PATCH a cart line for a paused / soft-deleted product
 *   - PATCH a digital cart line to qty > 1 (the addItem cap was
 *     bypassable through update)
 *   - Carry a stale cart through checkout after the seller paused or
 *     suspended the store
 * Throws a single `AppError(409, "ProductUnavailable", …)` for any
 * gate failure so the BFF surfaces a consistent error shape.
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
 * Resolve a productItemId to a fully-validated, ready-to-purchase row.
 * Throws when the product or store is in any state that should block
 * purchase. Returns the loaded shape so callers can keep the value
 * around without re-querying.
 * Deliberately does NOT enforce the actor's "isn't the store owner"
 * rule — that's caller-specific (only `cart.service.addItem` cares;
 * checkout has already accepted the line).
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
          deletedAt: true,
          storeId: true,
          store: {
            select: {
              ownerId: true,
              deletedAt: true,
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
  // Public-catalogue gates — match `findProducts`'s `where` clause so a
  // line that wouldn't surface on /browse can't sneak through cart.
  if (row.product.deletedAt) {
    throw new AppError(409, "ProductUnavailable", "This product is no longer available.");
  }
  if (!row.product.isActive) {
    throw new AppError(
      409,
      "ProductUnavailable",
      "This product is paused by the seller and can't be purchased right now.",
    );
  }
  if (row.product.store.deletedAt) {
    throw new AppError(409, "StoreUnavailable", "This store is no longer available.");
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
 * Cap a desired quantity at the variant's ceiling. Digital lines max
 * at 1, physical lines max at stock. Returns the capped value (>= 1
 * when `desired >= 1`; the caller decides whether to silently cap or
 * throw).
 */
export function capQuantity(
  desired: number,
  item: Pick<PurchasableProductItem, "isDigital" | "stock">,
): number {
  const ceiling = item.isDigital ? 1 : Math.max(1, item.stock);
  return Math.max(1, Math.min(desired, ceiling));
}
