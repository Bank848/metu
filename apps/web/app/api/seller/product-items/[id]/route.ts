import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/server/prisma";
import { withStore } from "@/lib/server/seller";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Targeted variant patch — used by the bulk-edit page to nudge price /
// discount / stock without resending the whole product payload.
const patchVariantSchema = z.object({
  price: z.number().min(0).optional(),
  discountPercent: z.number().min(0).max(100).optional(),
  quantity: z.number().int().min(0).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const r = await withStore(req);
  if (!r.ok) return r.response;
  const productItemId = Number(params.id);
  if (!Number.isFinite(productItemId)) return NextResponse.json({ error: "BadId" }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const parsed = patchVariantSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "ValidationError", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const item = await prisma.productItem.findUnique({
    where: { productItemId },
    include: { product: { select: { storeId: true } } },
  });
  if (!item) return NextResponse.json({ error: "NotFound" }, { status: 404 });
  if (item.product.storeId !== r.store.storeId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const data: Record<string, unknown> = {};
  if (parsed.data.price !== undefined) data.price = new Prisma.Decimal(parsed.data.price);
  if (parsed.data.discountPercent !== undefined) data.discountPercent = parsed.data.discountPercent;
  if (parsed.data.quantity !== undefined) data.quantity = parsed.data.quantity;

  const updated = await prisma.productItem.update({
    where: { productItemId },
    data,
  });
  return NextResponse.json({ ok: true, productItem: { ...updated, price: Number(updated.price) } });
}
