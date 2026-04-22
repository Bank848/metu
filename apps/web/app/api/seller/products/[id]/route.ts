import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { productInputSchema } from "@metu/shared";
import { prisma } from "@/lib/server/prisma";
import { withStore } from "@/lib/server/seller";
import { audit } from "@/lib/server/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Helper: confirm the product exists and belongs to the authed store.
async function assertOwnership(productId: number, storeId: number) {
  const product = await prisma.product.findUnique({ where: { productId } });
  if (!product) return { ok: false as const, status: 404, error: "NotFound" };
  if (product.storeId !== storeId) return { ok: false as const, status: 403, error: "Forbidden" };
  return { ok: true as const, product };
}

/** GET: fetch one of the seller's own products with all editable fields. */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const r = await withStore(req);
  if (!r.ok) return r.response;
  const productId = Number(params.id);
  if (!Number.isFinite(productId)) return NextResponse.json({ error: "BadId" }, { status: 400 });

  const own = await assertOwnership(productId, r.store.storeId);
  if (!own.ok) return NextResponse.json({ error: own.error }, { status: own.status });

  const product = await prisma.product.findUnique({
    where: { productId },
    include: {
      category: true,
      items: { orderBy: { productItemId: "asc" } },
      images: { orderBy: { sortOrder: "asc" } },
      productNTags: { include: { tag: true } },
    },
  });
  return NextResponse.json(product);
}

/** PATCH: either flip the `isActive` flag (lightweight pause toggle) or
 *  do a full edit replacing name/description/category + images + variants
 *  + tags. The body shape decides which path runs. */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const r = await withStore(req);
  if (!r.ok) return r.response;
  const productId = Number(params.id);
  if (!Number.isFinite(productId)) return NextResponse.json({ error: "BadId" }, { status: 400 });

  const own = await assertOwnership(productId, r.store.storeId);
  if (!own.ok) return NextResponse.json({ error: own.error }, { status: own.status });

  const body = await req.json().catch(() => ({}));

  // Pause-toggle fast path — `{ isActive: boolean }` only.
  if (
    typeof body?.isActive === "boolean" &&
    Object.keys(body).length === 1
  ) {
    await prisma.product.update({
      where: { productId },
      data: { isActive: body.isActive },
    });
    return NextResponse.json({ ok: true, isActive: body.isActive });
  }

  const parsed = productInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "ValidationError", details: parsed.error.flatten() }, { status: 400 });
  }
  const { name, description, categoryId, images, tagIds, items } = parsed.data;

  // Replace the related rows (images, variants, tags) in a single
  // transaction. This is simpler than computing a diff and is safe for the
  // demo — no other tables FK into ProductImage or ProductNTag.
  //
  // ProductItem is trickier: OrderItem and CartItem FK into it. We can't
  // blindly delete variants that have sales history. For now we only
  // create new ones and keep existing ones as-is (this mirrors what the
  // create form does). Sellers who need to fully replace variants can
  // delete the product and re-create.
  await prisma.$transaction(async (tx) => {
    await tx.product.update({
      where: { productId },
      data: { name, description, categoryId },
    });
    // Images — safe to wipe and re-create.
    await tx.productImage.deleteMany({ where: { productId } });
    await tx.productImage.createMany({
      data: images.map((url, i) => ({ productId, productImage: url, sortOrder: i })),
    });
    // Tags — junction table is safe to wipe.
    await tx.productNTag.deleteMany({ where: { productId } });
    if (tagIds.length) {
      await tx.productNTag.createMany({
        data: tagIds.map((tagId) => ({ productId, tagId })),
      });
    }
    // Variants — update existing rows that still exist, and create any
    // new ones the seller added. Deletion of existing variants is not
    // supported here because OrderItem / CartItem FK into ProductItem.
    const existing = await tx.productItem.findMany({ where: { productId }, orderBy: { productItemId: "asc" } });
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const target = existing[i];
      if (target) {
        await tx.productItem.update({
          where: { productItemId: target.productItemId },
          data: {
            deliveryMethod: it.deliveryMethod,
            quantity: it.quantity,
            price: new Prisma.Decimal(it.price),
            discountPercent: it.discountPercent,
            discountAmount: new Prisma.Decimal(it.discountAmount),
            sampleUrl: it.sampleUrl,
          },
        });
      } else {
        await tx.productItem.create({
          data: {
            productId,
            deliveryMethod: it.deliveryMethod,
            quantity: it.quantity,
            price: new Prisma.Decimal(it.price),
            discountPercent: it.discountPercent,
            discountAmount: new Prisma.Decimal(it.discountAmount),
            sampleUrl: it.sampleUrl,
          },
        });
      }
    }
  });

  return NextResponse.json({ ok: true });
}

/**
 * DELETE: soft-delete the product. We always set `deletedAt` (instead of
 * a real DB delete) — that way OrderItem rows pointing at this product
 * stay valid and order history is preserved. Public queries filter by
 * `deletedAt: null` so the product disappears from /browse, /product/[id],
 * featured, related, store pages, etc. immediately.
 */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const r = await withStore(req);
  if (!r.ok) return r.response;
  const productId = Number(params.id);
  if (!Number.isFinite(productId)) return NextResponse.json({ error: "BadId" }, { status: 400 });

  const own = await assertOwnership(productId, r.store.storeId);
  if (!own.ok) return NextResponse.json({ error: own.error }, { status: own.status });

  await prisma.product.update({
    where: { productId },
    data: { deletedAt: new Date() },
  });
  await audit({
    actorId: r.auth.uid,
    action: "product.delete",
    targetType: "product",
    targetId: productId,
    meta: { storeId: r.store.storeId, productName: own.product.name },
  });
  return NextResponse.json({ ok: true });
}
