import { NextResponse, type NextRequest } from "next/server";
import { addToCartSchema } from "@metu/shared";
import { prisma } from "@/lib/server/prisma";
import { requireAuth } from "@/lib/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const r = await requireAuth(req);
  if (!r.ok) return r.response;
  const body = await req.json().catch(() => ({}));
  const parsed = addToCartSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "ValidationError", details: parsed.error.flatten() }, { status: 400 });
  }
  let cart = await prisma.cart.findFirst({ where: { userId: r.auth.uid, status: "active" } });
  if (!cart) cart = await prisma.cart.create({ data: { userId: r.auth.uid, status: "active" } });
  const { productItemId, quantity } = parsed.data;
  const existing = await prisma.cartItem.findUnique({
    where: { cartId_productItemId: { cartId: cart.cartId, productItemId } },
  });
  if (existing) {
    const updated = await prisma.cartItem.update({
      where: { cartItemId: existing.cartItemId },
      data: { quantity: existing.quantity + quantity },
    });
    return NextResponse.json({ ok: true, cartItem: updated, merged: true });
  }
  const created = await prisma.cartItem.create({
    data: { cartId: cart.cartId, productItemId, quantity },
  });
  return NextResponse.json({ ok: true, cartItem: created, merged: false });
}
