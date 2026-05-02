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
  const existing = await prisma.cart.findFirst({
    where: { userId, status: "active" },
  });
  if (existing) return existing;
  return prisma.cart.create({ data: { userId, status: "active" } });
}

/**
 * Read the current cart with its lines + the joins needed to render
 * a row (product name + store + thumbnail + computed unit price).
 *
 * Same shape as the legacy BFF `GET /api/cart` route — included
 * `stock` so the cart UI can cap quantity input.
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
      stock: ci.productItem.quantity,
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
 * Add (or merge) a productItem into the cart. The unique
 * `(cartId, productItemId)` constraint means duplicate adds collapse
 * into a quantity bump — UX expectation is "click + again, see qty 2",
 * not "see two rows".
 *
 * Phase 45 follow-up — enforce the cap promised in
 * `addToCartSchema`'s "server enforces the real cap" comment:
 *   - Digital deliveryMethods (download / email / license_key /
 *     streaming) are single-use, so the merged quantity caps at 1.
 *     Without this cap, "Add to cart" + "Buy now" on a digital item
 *     bumped it to qty=2 (frontend max=1 disagreed with stored state,
 *     so the qty stepper looked broken and the line refused to update).
 *   - Physical / service lines cap at the variant's `stock` so we
 *     never reserve more than the seller has on hand.
 */
export async function addItem(
  userId: number,
  input: AddToCartInput,
): Promise<{ cartItem: unknown; merged: boolean }> {
  // Phase 50 — single source of truth for "is this productItem buyable
  // right now?". Throws 404 ProductItemNotFound, 409 ProductUnavailable,
  // or 409 StoreUnavailable for any availability gate failure.
  const item = await loadPurchasableProductItem(input.productItemId);

  // Guard: a store owner shouldn't buy from their own store. We catch
  // it here so the BFF gives a clean 400 even if the frontend's hide-
  // the-button check is bypassed (e.g. someone hits the API directly).
  if (item.product.store.ownerId === userId) {
    throw new AppError(400, "CannotBuyOwnProduct", "You can't buy from your own store.");
  }

  // Phase 48 — already-owned guard. Single-copy products
  // (download / streaming / email — anything with isStackable=false)
  // can't be bought twice by the same buyer. license_key + seller-
  // override products bypass this rule. Refunded orders are excluded
  // from the lookup so a buyer can re-purchase after a refund.
  if (!item.product.isStackable) {
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
 * Update a single line's quantity. Ownership check ensures one user
 * can't edit another user's cart line — the controller throws 404
 * on either "no such row" or "row belongs to someone else" (don't
 * leak whether the id exists).
 *
 * Phase 50 — also re-validates availability + caps quantity through
 * the same `loadPurchasableProductItem` path that addItem uses, so
 * a PATCH to qty=10 on a digital line caps to 1 instead of writing
 * the raw value (the previous code path didn't cap at all, which
 * let the digital cap from addItem be bypassed).
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
