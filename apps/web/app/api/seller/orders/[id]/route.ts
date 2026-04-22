import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { withStore } from "@/lib/server/seller";
import { audit } from "@/lib/server/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Sellers can move an order forward (fulfilled) or cancel it. They cannot
// mark something as paid/pending (that's the checkout flow) and they cannot
// issue refunds (that's admin-only).
const ALLOWED_NEW_STATUS = new Set(["fulfilled", "cancelled"] as const);
type AllowedStatus = "fulfilled" | "cancelled";

/** PATCH: change order status. Requires the order to contain at least one
 *  line item from the seller's store. */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const r = await withStore(req);
  if (!r.ok) return r.response;
  const orderId = Number(params.id);
  if (!Number.isFinite(orderId)) return NextResponse.json({ error: "BadId" }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const next = body?.status as string | undefined;
  if (!next || !ALLOWED_NEW_STATUS.has(next as AllowedStatus)) {
    return NextResponse.json(
      { error: "ValidationError", message: "status must be fulfilled or cancelled" },
      { status: 400 },
    );
  }

  // Ownership: one of the order items must belong to a product the seller
  // owns. This avoids a seller being able to touch orders that have no
  // overlap with their inventory.
  const order = await prisma.order.findUnique({
    where: { orderId },
    include: {
      items: { include: { productItem: { select: { product: { select: { storeId: true } } } } } },
    },
  });
  if (!order) return NextResponse.json({ error: "NotFound" }, { status: 404 });
  const hasOwnedItem = order.items.some((it) => it.productItem.product.storeId === r.store.storeId);
  if (!hasOwnedItem) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Guardrails: only move forward from paid. Never override a refund.
  if (order.status === "refunded") {
    return NextResponse.json({ error: "AlreadyRefunded" }, { status: 409 });
  }
  if (next === "fulfilled" && order.status !== "paid") {
    return NextResponse.json(
      { error: "InvalidTransition", message: "Only paid orders can be fulfilled." },
      { status: 409 },
    );
  }

  await prisma.order.update({
    where: { orderId },
    data: { status: next as AllowedStatus },
  });
  await audit({
    actorId: r.auth.uid,
    action: next === "fulfilled" ? "order.fulfilled" : "order.cancelled",
    targetType: "order",
    targetId: orderId,
    meta: { from: order.status, to: next, storeId: r.store.storeId },
  });
  return NextResponse.json({ ok: true });
}
