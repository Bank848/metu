import { prisma } from "../db/prisma.js";
import { AppError } from "../utils/errors.js";
import { capQuantity, loadPurchasableProductItem } from "../utils/purchasable.js";
import type {
  AddToCartInput,
  CartLine,
  CartResponse,
  UpdateCartItemInput,
} from "../models/cart.model.js";

/**
 * Resolve (or create) the user's single active cart row. Each user
 * has exactly one `status: "active"` cart at a time — checkout flips
 * the active cart's status to `"converted"` and a fresh active row is
 * created on the next POST /items.
 */
async function getOrCreateActiveCart(userId: number) {
  // Pick the latest active cart deterministically (legacy data may have
  // multiple active rows for one user).
  const existing = await prisma.cart.findFirst({
    where: { userId, status: "active" },
    orderBy: { cartId: "desc" },
  });
  if (existing) return existing;
  return prisma.cart.create({ data: { userId, status: "active" } });
}

/**
 * Read the active cart with line joins needed for rendering, plus
 * `stock` so the UI can cap the quantity input.
 */
export async function getCart(userId: number): Promise<CartResponse> {
  const cart = await getOrCreateActiveCart(userId);
  const items = await prisma.cartItem.findMany({
    where: { cartId: cart.cartId },
    include: {
      productItem: {
        include: {
          product: {
            include: {
              store: { select: { storeId: true, name: true, profileImage: true } },
              images: { take: 1, orderBy: { sortOrder: "asc" } },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const lines: CartLine[] = items.map((ci) => {
    const price = Number(ci.productItem.price);
    const discount = (price * (ci.productItem.discountPercent ?? 0)) / 100;
    const unit = Math.max(0, price - discount);
    return {
      cartItemId: ci.cartItemId,
      productItemId: ci.productItemId,
      productId: ci.productItem.productId,
      productName: ci.productItem.product.name,
      storeId: ci.productItem.product.store.storeId,
      storeName: ci.productItem.product.store.name,
      image: ci.productItem.product.images[0]?.productImage ?? null,
      deliveryMethod: ci.productItem.deliveryMethod,
      stock: ci.productItem.quantity ?? 0,
      stockRaw: ci.productItem.quantity,
      isStackable: ci.productItem.product.isStackable,
      unitPrice: unit,
      basePrice: price,
      discountPercent: ci.productItem.discountPercent,
      quantity: ci.quantity,
      lineTotal: unit * ci.quantity,
    };
  });

  const subtotal = lines.reduce((a, b) => a + b.lineTotal, 0);
  return { cartId: cart.cartId, items: lines, subtotal };
}

/**
 * Add or merge a productItem into the cart. Duplicate adds collapse
 * via the unique (cartId, productItemId) constraint and quantity is
 * capped: digital methods at 1, physical at the variant's stock.
 */
export async function addItem(
  userId: number,
  input: AddToCartInput,
): Promise<{ cartItem: unknown; merged: boolean }> {
  // Single buyability gate; throws on any availability failure.
  const item = await loadPurchasableProductItem(input.productItemId);

  // Owner-buys-own-store guard.
  if (item.product.store.ownerId === userId) {
    throw new AppError(400, "CannotBuyOwnProduct", "You can't buy from your own store.");
  }

  // Already-owned guard. Only stackable license_key variants bypass
  // (buyer can collect multiple keys); download / streaming / email
  // and non-stackable license_key all stay single-purchase. Matches
  // the same rule in orders.service.checkout so the cart-add path
  // doesn't accept lines that checkout would later reject.
  if (!(item.product.isStackable && item.deliveryMethod === "license_key")) {
    const owned = await prisma.order.findFirst({
      where: {
        userId,
        status: { in: ["paid", "fulfilled", "pending"] },
        items: {
          some: { productItem: { productId: item.product.productId } },
        },
      },
      select: { orderId: true, status: true },
      orderBy: { createdAt: "desc" },
    });
    if (owned) {
      const detail = owned.status === "pending"
        ? `You already have an order in flight for this — view order #${owned.orderId}.`
        : `You already own this — view your order #${owned.orderId}.`;
      throw new AppError(409, "AlreadyOwned", detail, { orderId: owned.orderId });
    }
  }

  const cart = await getOrCreateActiveCart(userId);
  const existing = await prisma.cartItem.findUnique({
    where: {
      cartId_productItemId: {
        cartId: cart.cartId,
        productItemId: input.productItemId,
      },
    },
  });
  if (existing) {
    // Cap the merged quantity at the variant's real ceiling so we never
    // store a qty above what the buyer can actually check out with.
    const capped = capQuantity(existing.quantity + input.quantity, item);
    if (capped === existing.quantity) {
      // Already at the cap — return existing row untouched (idempotent
      // no-op for "Add to cart" then "Buy now" on a digital item).
      return { cartItem: existing, merged: true };
    }
    const updated = await prisma.cartItem.update({
      where: { cartItemId: existing.cartItemId },
      data: { quantity: capped },
    });
    return { cartItem: updated, merged: true };
  }
  const created = await prisma.cartItem.create({
    data: {
      cartId: cart.cartId,
      productItemId: input.productItemId,
      quantity: capQuantity(input.quantity, item),
    },
  });
  return { cartItem: created, merged: false };
}

/**
 * Update a line's quantity with ownership + availability re-validation.
 * Caps via the same loadPurchasableProductItem path as addItem.
 */
export async function updateItem(
  userId: number,
  cartItemId: number,
  input: UpdateCartItemInput,
): Promise<unknown> {
  const ci = await prisma.cartItem.findUnique({
    where: { cartItemId },
    include: { cart: { select: { userId: true } } },
  });
  if (!ci || ci.cart.userId !== userId) {
    throw new AppError(404, "CartItemNotFound");
  }
  const item = await loadPurchasableProductItem(ci.productItemId);
  return prisma.cartItem.update({
    where: { cartItemId },
    data: { quantity: capQuantity(input.quantity, item) },
  });
}

/**
 * Remove a line. Same ownership gate as updateItem.
 */
export async function removeItem(userId: number, cartItemId: number): Promise<void> {
  const ci = await prisma.cartItem.findUnique({
    where: { cartItemId },
    include: { cart: { select: { userId: true } } },
  });
  if (!ci || ci.cart.userId !== userId) {
    throw new AppError(404, "CartItemNotFound");
  }
  await prisma.cartItem.delete({ where: { cartItemId } });
}
