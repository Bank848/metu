import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireAuth } from "@/lib/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** DELETE: remove a store (cascades to its products, coupons, reviews, etc.). */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const r = await requireAuth(req, ["admin"]);
  if (!r.ok) return r.response;
  const storeId = Number(params.id);
  if (!Number.isFinite(storeId)) return NextResponse.json({ error: "BadId" }, { status: 400 });

  await prisma.store.delete({ where: { storeId } });
  return NextResponse.json({ ok: true });
}
