import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireAuth } from "@/lib/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** DELETE: drop a transaction record (orders keep their nullable transactionId). */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const r = await requireAuth(req, ["admin"]);
  if (!r.ok) return r.response;
  const transactionId = Number(params.id);
  if (!Number.isFinite(transactionId)) return NextResponse.json({ error: "BadId" }, { status: 400 });

  await prisma.transaction.delete({ where: { transactionId } });
  return NextResponse.json({ ok: true });
}
