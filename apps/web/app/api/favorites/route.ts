import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireAuth } from "@/lib/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/favorites — list the current user's favourited productIds. Light
 *  response shape because the /favorites page hydrates full products via
 *  direct Prisma. Used by client components to know initial heart state. */
export async function GET(req: NextRequest) {
  const r = await requireAuth(req);
  if (!r.ok) return r.response;
  const rows = await prisma.productFavorite.findMany({
    where: { userId: r.auth.uid },
    select: { productId: true },
  });
  return NextResponse.json({ productIds: rows.map((r) => r.productId) });
}
