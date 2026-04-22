import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/server/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? 20), 60);
  const stores = await prisma.store.findMany({
    where: { deletedAt: null },
    take: limit,
    orderBy: { createdAt: "desc" },
    include: {
      businessType: true,
      stats: true,
      _count: { select: { products: { where: { deletedAt: null } } } },
    },
  });
  return NextResponse.json(stores);
}
