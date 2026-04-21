import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireAuth } from "@/lib/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST: refund a purchase transaction.
 *  - Marks all linked orders as `refunded`.
 *  - Inserts a new `refund` Transaction for the same buyer + amount.
 * Idempotent-ish: refusing if the transaction is not a purchase or has
 * already been refunded today.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const r = await requireAuth(req, ["admin"]);
  if (!r.ok) return r.response;
  const transactionId = Number(params.id);
  if (!Number.isFinite(transactionId)) return NextResponse.json({ error: "BadId" }, { status: 400 });

  const tx = await prisma.transaction.findUnique({
    where: { transactionId },
    include: { orders: true },
  });
  if (!tx) return NextResponse.json({ error: "NotFound" }, { status: 404 });
  if (tx.transactionType !== "purchase") {
    return NextResponse.json({ error: "NotPurchase", message: "Only purchase transactions can be refunded." }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.order.updateMany({
      where: { transactionId },
      data: { status: "refunded" },
    }),
    prisma.transaction.create({
      data: {
        userId: tx.userId,
        transactionType: "refund",
        totalAmount: tx.totalAmount,
      },
    }),
  ]);
  return NextResponse.json({ ok: true });
}
