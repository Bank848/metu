import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireAuth } from "@/lib/server/auth";
import { audit } from "@/lib/server/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * DELETE: soft-delete a store. Public queries filter `deletedAt: null` so
 * the store + its products vanish from the marketplace immediately, but
 * order and review history is preserved. Admin can restore by clearing
 * `deletedAt` directly in the DB if needed.
 */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const r = await requireAuth(req, ["admin"]);
  if (!r.ok) return r.response;
  const storeId = Number(params.id);
  if (!Number.isFinite(storeId)) return NextResponse.json({ error: "BadId" }, { status: 400 });

  await prisma.store.update({
    where: { storeId },
    data: { deletedAt: new Date() },
  });
  await audit({
    actorId: r.user.userId,
    action: "store.delete",
    targetType: "store",
    targetId: storeId,
  });
  return NextResponse.json({ ok: true });
}
