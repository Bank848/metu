import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireAuth } from "@/lib/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const r = await requireAuth(req);
  if (!r.ok) return r.response;
  const id = Number(params.id);
  const order = await prisma.order.findFirst({
    where: { orderId: id, cart: { userId: r.auth.uid } },
    include: {
      items: {
        include: {
          productItem: {
            include: {
              product: {
                include: {
                  images: { take: 1, orderBy: { sortOrder: "asc" } },
                  store: { select: { name: true, storeId: true } },
                },
              },
            },
          },
          coupon: true,
        },
      },
      transaction: true,
    },
  });
  if (!order) return NextResponse.json({ error: "NotFound" }, { status: 404 });
  return NextResponse.json(order);
}
