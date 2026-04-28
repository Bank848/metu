import { prisma } from "../db/prisma.js";
import { AppError } from "../utils/errors.js";
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
 */
export async function addItem(
  userId: number,
  input: AddToCartInput,
): Promise<{ cartItem: unknown; merged: boolean }> {
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
    const updated = await prisma.cartItem.update({
      where: { cartItemId: existing.cartItemId },
      data: { quantity: existing.quantity + input.quantity },
    });
    return { cartItem: updated, merged: true };
  }
  const created = await prisma.cartItem.create({
    data: {
      cartId: cart.cartId,
      productItemId: input.productItemId,
      quantity: input.quantity,
    },
  });
  return { cartItem: created, merged: false };
}

/**
 * Update a single line's quantity. Ownership check ensures one user
 * can't edit another user's cart line — the controller throws 404
 * on either "no such row" or "row belongs to someone else" (don't
 * leak whether the id exists).
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
  return prisma.cartItem.update({
    where: { cartItemId },
    data: { quantity: input.quantity },
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
