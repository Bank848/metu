import { NextResponse, type NextRequest } from "next/server";
import { updateCartItemSchema } from "@metu/shared";
import { prisma } from "@/lib/server/prisma";
import { requireAuth } from "@/lib/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const r = await requireAuth(req);
  if (!r.ok) return r.response;
  const body = await req.json().catch(() => ({}));
  const parsed = updateCartItemSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "ValidationError" }, { status: 400 });
  const id = Number(params.id);
  const ci = await prisma.cartItem.findUnique({ where: { cartItemId: id }, include: { cart: true } });
  if (!ci || ci.cart.userId !== r.auth.uid) return NextResponse.json({ error: "NotFound" }, { status: 404 });
  const updated = await prisma.cartItem.update({
    where: { cartItemId: id },
    data: { quantity: parsed.data.quantity },
  });
  return NextResponse.json({ ok: true, cartItem: updated });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const r = await requireAuth(req);
  if (!r.ok) return r.response;
  const id = Number(params.id);
  const ci = await prisma.cartItem.findUnique({ where: { cartItemId: id }, include: { cart: true } });
  if (!ci || ci.cart.userId !== r.auth.uid) return NextResponse.json({ error: "NotFound" }, { status: 404 });
  await prisma.cartItem.delete({ where: { cartItemId: id } });
  return NextResponse.json({ ok: true });
}
