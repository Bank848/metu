import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireAuth } from "@/lib/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const r = await requireAuth(req, ["admin"]);
  if (!r.ok) return r.response;
  const stores = await prisma.store.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      owner: { select: { username: true, firstName: true, lastName: true, profileImage: true } },
      businessType: true,
      stats: true,
      _count: { select: { products: true } },
    },
  });
  return NextResponse.json(stores);
}
