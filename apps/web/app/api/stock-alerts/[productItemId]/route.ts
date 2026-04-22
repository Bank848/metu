import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireAuth } from "@/lib/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/stock-alerts/[productItemId] — subscribe (idempotent via the
 * @@unique([userId, productItemId]) constraint).
 * DELETE /api/stock-alerts/[productItemId] — unsubscribe.
 *
 * Sellers don't see anything different yet; in a future batch the
 * email-stub fires when ProductItem.quantity goes from 0 → positive.
 */
export async function POST(req: NextRequest, { params }: { params: { productItemId: string } }) {
  const r = await requireAuth(req);
  if (!r.ok) return r.response;
  const productItemId = Number(params.productItemId);
  if (!Number.isFinite(productItemId)) return NextResponse.json({ error: "BadId" }, { status: 400 });

  // Confirm the variant exists and the parent product/store wasn't
  // soft-deleted — no point subscribing to ghosts.
  const exists = await prisma.productItem.findFirst({
    where: {
      productItemId,
      product: { deletedAt: null, store: { deletedAt: null } },
    },
    select: { productItemId: true },
  });
  if (!exists) return NextResponse.json({ error: "NotFound" }, { status: 404 });

  await prisma.stockAlert.upsert({
    where: { userId_productItemId: { userId: r.auth.uid, productItemId } },
    update: { notifiedAt: null },
    create: { userId: r.auth.uid, productItemId },
  });
  return NextResponse.json({ ok: true, subscribed: true });
}

export async function DELETE(req: NextRequest, { params }: { params: { productItemId: string } }) {
  const r = await requireAuth(req);
  if (!r.ok) return r.response;
  const productItemId = Number(params.productItemId);
  if (!Number.isFinite(productItemId)) return NextResponse.json({ error: "BadId" }, { status: 400 });
  await prisma.stockAlert.deleteMany({
    where: { userId: r.auth.uid, productItemId },
  });
  return NextResponse.json({ ok: true, subscribed: false });
}
