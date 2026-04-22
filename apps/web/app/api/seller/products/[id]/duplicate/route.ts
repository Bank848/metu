import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/server/prisma";
import { withStore } from "@/lib/server/seller";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/seller/products/[id]/duplicate — create a near-identical copy
 * of one of the seller's own products. Useful for templating new SKUs
 * off an existing winner. Reviews + sales history don't get copied
 * (those would obviously be misleading).
 *
 * The new product is created **paused** (`isActive=false`) so the
 * seller can polish the copy before exposing it to buyers.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const r = await withStore(req);
  if (!r.ok) return r.response;
  const sourceId = Number(params.id);
  if (!Number.isFinite(sourceId)) return NextResponse.json({ error: "BadId" }, { status: 400 });

  const source = await prisma.product.findFirst({
    where: { productId: sourceId, deletedAt: null },
    include: {
      items: true,
      images: { orderBy: { sortOrder: "asc" } },
      productNTags: true,
    },
  });
  if (!source) return NextResponse.json({ error: "NotFound" }, { status: 404 });
  if (source.storeId !== r.store.storeId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Trim to fit the 100-char name limit when prefixing "Copy of".
  const newName = `Copy of ${source.name}`.slice(0, 100);

  const created = await prisma.product.create({
    data: {
      storeId: source.storeId,
      categoryId: source.categoryId,
      name: newName,
      description: source.description,
      isActive: false,
      items: {
        create: source.items.map((it) => ({
          deliveryMethod: it.deliveryMethod,
          quantity: it.quantity,
          price: new Prisma.Decimal(it.price),
          discountPercent: it.discountPercent,
          discountAmount: new Prisma.Decimal(it.discountAmount),
        })),
      },
      images: {
        create: source.images.map((im) => ({
          productImage: im.productImage,
          sortOrder: im.sortOrder,
        })),
      },
      productNTags: {
        create: source.productNTags.map((nt) => ({ tagId: nt.tagId })),
      },
    },
  });
  return NextResponse.json({ ok: true, productId: created.productId });
}
