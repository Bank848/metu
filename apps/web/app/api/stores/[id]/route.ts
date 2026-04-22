import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  // Public — soft-deleted stores 404, soft-deleted products are filtered out.
  const store = await prisma.store.findFirst({
    where: { storeId: id, deletedAt: null },
    include: {
      owner: { select: { firstName: true, lastName: true, profileImage: true, username: true } },
      businessType: true,
      stats: true,
      products: {
        where: { deletedAt: null },
        include: {
          items: { select: { price: true, discountPercent: true } },
          images: { take: 1, orderBy: { sortOrder: "asc" } },
          reviews: { select: { rating: true } },
        },
      },
    },
  });
  if (!store) return NextResponse.json({ error: "NotFound" }, { status: 404 });
  return NextResponse.json(store);
}
