import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireAuth } from "@/lib/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getOrCreateActiveCart(userId: number) {
  let cart = await prisma.cart.findFirst({ where: { userId, status: "active" } });
  if (!cart) cart = await prisma.cart.create({ data: { userId, status: "active" } });
  return cart;
}

export async function GET(req: NextRequest) {
  const r = await requireAuth(req);
  if (!r.ok) return r.response;
  const cart = await getOrCreateActiveCart(r.auth.uid);
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
  return NextResponse.json({ cartId: cart.cartId, items: lines, subtotal });
}
