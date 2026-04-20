import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { withStore } from "@/lib/server/seller";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const r = await withStore(req);
  if (!r.ok) return r.response;
  const status = req.nextUrl.searchParams.get("status") || undefined;
  const rows = await prisma.order.findMany({
    where: {
      ...(status ? { status: status as any } : {}),
      items: { some: { productItem: { product: { storeId: r.store.storeId } } } },
    },
    orderBy: { createdAt: "desc" },
    include: {
      cart: { include: { user: { select: { username: true, firstName: true, lastName: true, profileImage: true } } } },
      items: {
        where: { productItem: { product: { storeId: r.store.storeId } } },
        include: {
          productItem: {
            include: { product: { select: { name: true, productId: true, images: { take: 1, orderBy: { sortOrder: "asc" } } } } },
          },
        },
      },
      transaction: true,
    },
  });
  return NextResponse.json(rows);
}
