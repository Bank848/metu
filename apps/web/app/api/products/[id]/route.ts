import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "BadRequest" }, { status: 400 });
  // Public — soft-deleted products + orphan products (deleted store) 404.
  const product = await prisma.product.findFirst({
    where: { productId: id, deletedAt: null, store: { deletedAt: null } },
    include: {
      store: { include: { stats: true, businessType: true } },
      category: true,
      items: { orderBy: { price: "asc" } },
      images: { orderBy: { sortOrder: "asc" } },
      productNTags: { include: { tag: true } },
      reviews: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: {
          user: { select: { firstName: true, lastName: true, profileImage: true, username: true } },
        },
      },
    },
  });
  if (!product) return NextResponse.json({ error: "NotFound" }, { status: 404 });
  const ratings = product.reviews.map((r) => r.rating);
  const avgRating = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : undefined;
  return NextResponse.json({ ...product, avgRating, reviewCount: ratings.length });
}
