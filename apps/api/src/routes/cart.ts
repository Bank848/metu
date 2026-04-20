import { Router } from "express";
import { addToCartSchema, updateCartItemSchema } from "@metu/shared";
import { prisma } from "../lib/prisma.js";
import { currentAuth, requireAuth } from "../lib/auth.js";

export const cartRouter = Router();

async function getOrCreateActiveCart(userId: number) {
  let cart = await prisma.cart.findFirst({
    where: { userId, status: "active" },
  });
  if (!cart) {
    cart = await prisma.cart.create({ data: { userId, status: "active" } });
  }
  return cart;
}

cartRouter.get("/", requireAuth(), async (req, res, next) => {
  try {
    const auth = currentAuth(req)!;
    const cart = await getOrCreateActiveCart(auth.uid);
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
    const lines = items.map((ci) => {
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
        unitPrice: unit,
        basePrice: price,
        discountPercent: ci.productItem.discountPercent,
        quantity: ci.quantity,
        lineTotal: unit * ci.quantity,
      };
    });
    const subtotal = lines.reduce((a, b) => a + b.lineTotal, 0);
    res.json({ cartId: cart.cartId, items: lines, subtotal });
  } catch (err) {
    next(err);
  }
});

cartRouter.post("/items", requireAuth(), async (req, res, next) => {
  try {
    const parsed = addToCartSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "ValidationError", details: parsed.error.flatten() });
      return;
    }
    const auth = currentAuth(req)!;
    const cart = await getOrCreateActiveCart(auth.uid);
    const { productItemId, quantity } = parsed.data;

    // If same productItem is already in the cart, increment quantity instead of duplicating.
    const existing = await prisma.cartItem.findUnique({
      where: { cartId_productItemId: { cartId: cart.cartId, productItemId } },
    });
    if (existing) {
      const updated = await prisma.cartItem.update({
        where: { cartItemId: existing.cartItemId },
        data: { quantity: existing.quantity + quantity },
      });
      res.json({ ok: true, cartItem: updated, merged: true });
      return;
    }
    const created = await prisma.cartItem.create({
      data: { cartId: cart.cartId, productItemId, quantity },
    });
    res.json({ ok: true, cartItem: created, merged: false });
  } catch (err) {
    next(err);
  }
});

cartRouter.patch("/items/:id", requireAuth(), async (req, res, next) => {
  try {
    const parsed = updateCartItemSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "ValidationError" });
      return;
    }
    const id = Number(req.params.id);
    const auth = currentAuth(req)!;
    const ci = await prisma.cartItem.findUnique({
      where: { cartItemId: id },
      include: { cart: true },
    });
    if (!ci || ci.cart.userId !== auth.uid) {
      res.status(404).json({ error: "NotFound" });
      return;
    }
    const updated = await prisma.cartItem.update({
      where: { cartItemId: id },
      data: { quantity: parsed.data.quantity },
    });
    res.json({ ok: true, cartItem: updated });
  } catch (err) {
    next(err);
  }
});

cartRouter.delete("/items/:id", requireAuth(), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const auth = currentAuth(req)!;
    const ci = await prisma.cartItem.findUnique({
      where: { cartItemId: id },
      include: { cart: true },
    });
    if (!ci || ci.cart.userId !== auth.uid) {
      res.status(404).json({ error: "NotFound" });
      return;
    }
    await prisma.cartItem.delete({ where: { cartItemId: id } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
