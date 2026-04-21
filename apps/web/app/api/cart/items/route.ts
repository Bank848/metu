import { NextResponse, type NextRequest } from "next/server";
import { addToCartSchema } from "@metu/shared";
import { prisma } from "@/lib/server/prisma";
import { requireAuth } from "@/lib/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DIGITAL_METHODS = new Set(["download", "email", "license_key", "streaming"]);

export async function POST(req: NextRequest) {
  const r = await requireAuth(req);
  if (!r.ok) return r.response;
  const body = await req.json().catch(() => ({}));
  const parsed = addToCartSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "ValidationError", details: parsed.error.flatten() }, { status: 400 });
  }
  const { productItemId, quantity } = parsed.data;

  // Enforce stock + digital caps server-side so a crafted client can't
  // bypass the UI controls.
  const productItem = await prisma.productItem.findUnique({ where: { productItemId } });
  if (!productItem) return NextResponse.json({ error: "NotFound" }, { status: 404 });
  const maxAllowed = DIGITAL_METHODS.has(productItem.deliveryMethod) ? 1 : Math.max(1, productItem.quantity);

  let cart = await prisma.cart.findFirst({ where: { userId: r.auth.uid, status: "active" } });
  if (!cart) cart = await prisma.cart.create({ data: { userId: r.auth.uid, status: "active" } });
  const existing = await prisma.cartItem.findUnique({
    where: { cartId_productItemId: { cartId: cart.cartId, productItemId } },
  });
  const resultingQty = (existing?.quantity ?? 0) + quantity;
  if (resultingQty > maxAllowed) {
    return NextResponse.json(
      { error: "QuantityExceedsStock", maxAllowed, message: `Max ${maxAllowed} for this item.` },
      { status: 400 },
    );
  }

  if (existing) {
    const updated = await prisma.cartItem.update({
      where: { cartItemId: existing.cartItemId },
      data: { quantity: resultingQty },
    });
    return NextResponse.json({ ok: true, cartItem: updated, merged: true });
  }
  const created = await prisma.cartItem.create({
    data: { cartId: cart.cartId, productItemId, quantity },
  });
  return NextResponse.json({ ok: true, cartItem: created, merged: false });
}
