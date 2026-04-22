import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireAuth } from "@/lib/server/auth";
import { audit } from "@/lib/server/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * DELETE: drop a transaction record (orders keep their nullable
 * transactionId). Transactions don't carry a `deletedAt` column — money
 * records are either there or they're not. Audit captures the actor +
 * the deleted amount so the trail survives the row.
 */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const r = await requireAuth(req, ["admin"]);
  if (!r.ok) return r.response;
  const transactionId = Number(params.id);
  if (!Number.isFinite(transactionId)) return NextResponse.json({ error: "BadId" }, { status: 400 });

  // Snapshot before delete so the audit row keeps the amount + type.
  const snap = await prisma.transaction.findUnique({
    where: { transactionId },
    select: { userId: true, transactionType: true, totalAmount: true },
  });
  await prisma.transaction.delete({ where: { transactionId } });
  await audit({
    actorId: r.user.userId,
    action: "transaction.delete",
    targetType: "transaction",
    targetId: transactionId,
    meta: snap
      ? { userId: snap.userId, type: snap.transactionType, amount: Number(snap.totalAmount) }
      : null,
  });
  return NextResponse.json({ ok: true });
}
