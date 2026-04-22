import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { withStore } from "@/lib/server/seller";
import { audit } from "@/lib/server/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST: seller-initiated refund on an order.
 *  - Marks the order as `refunded`.
 *  - Inserts a matching `refund` Transaction for the buyer + full order total.
 *
 * Sellers can refund orders that have at least one line from their store, and
 * that are currently `paid` or `fulfilled` (pending orders have no money yet;
 * cancelled/refunded orders shouldn't double-refund).
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const r = await withStore(req);
  if (!r.ok) return r.response;
  const orderId = Number(params.id);
  if (!Number.isFinite(orderId)) return NextResponse.json({ error: "BadId" }, { status: 400 });

  const order = await prisma.order.findUnique({
    where: { orderId },
    include: {
      cart: { select: { userId: true } },
      items: { include: { productItem: { select: { product: { select: { storeId: true } } } } } },
    },
  });
  if (!order) return NextResponse.json({ error: "NotFound" }, { status: 404 });

  const hasOwnedItem = order.items.some(
    (it) => it.productItem.product.storeId === r.store.storeId,
  );
  if (!hasOwnedItem) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (!["paid", "fulfilled"].includes(order.status)) {
    return NextResponse.json(
      { error: "InvalidTransition", message: `Can't refund an order that's ${order.status}.` },
      { status: 409 },
    );
  }

  await prisma.$transaction([
    prisma.order.update({ where: { orderId }, data: { status: "refunded" } }),
    prisma.transaction.create({
      data: {
        userId: order.cart.userId,
        transactionType: "refund",
        totalAmount: order.totalPrice,
      },
    }),
  ]);
  await audit({
    actorId: r.auth.uid,
    action: "order.refund",
    targetType: "order",
    targetId: orderId,
    meta: {
      buyerId: order.cart.userId,
      amount: Number(order.totalPrice),
      storeId: r.store.storeId,
      from: order.status,
    },
  });

  return NextResponse.json({ ok: true });
}
