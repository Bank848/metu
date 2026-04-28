import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { productInputSchema } from "@metu/shared";
import { prisma } from "@/lib/server/prisma";
import { withStore } from "@/lib/server/seller";
import { forwardToApi } from "@/lib/server/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Phase 13.9.1 — GET forwards to Express. POST stays here until
 * Phase 13.9.2 migrates the write side.
 */
export async function GET(req: NextRequest) {
  return forwardToApi(req, `/seller/products`);
}

export async function POST(req: NextRequest) {
  const r = await withStore(req);
  if (!r.ok) return r.response;
  const body = await req.json().catch(() => ({}));
  const parsed = productInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "ValidationError", details: parsed.error.flatten() }, { status: 400 });
  }
  const { name, description, categoryId, images, tagIds, items } = parsed.data;
  const product = await prisma.product.create({
    data: {
      storeId: r.store.storeId,
      categoryId, name, description,
      items: {
        create: items.map((it) => ({
          deliveryMethod: it.deliveryMethod,
          quantity: it.quantity,
          price: new Prisma.Decimal(it.price),
          discountPercent: it.discountPercent,
          discountAmount: new Prisma.Decimal(it.discountAmount),
          sampleUrl: it.sampleUrl,
        })),
      },
      images: { create: images.map((url, i) => ({ productImage: url, sortOrder: i })) },
      productNTags: { create: tagIds.map((tagId) => ({ tagId })) },
    },
  });
  return NextResponse.json(product);
}
