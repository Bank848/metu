import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireAuth } from "@/lib/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/messages/unread — cheap unread count for the sidebar dot. */
export async function GET(req: NextRequest) {
  const r = await requireAuth(req);
  if (!r.ok) return r.response;
  const count = await prisma.message.count({
    where: { recipientId: r.auth.uid, readAt: null },
  });
  return NextResponse.json({ count });
}
