import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  const store = await prisma.store.findUnique({
    where: { storeId: id },
    include: {
      owner: { select: { firstName: true, lastName: true, profileImage: true, username: true } },
      businessType: true,
      stats: true,
      products: {
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
