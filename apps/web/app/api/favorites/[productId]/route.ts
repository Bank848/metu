import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireAuth } from "@/lib/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST → heart the product. Idempotent via the unique (user, product). */
export async function POST(req: NextRequest, { params }: { params: { productId: string } }) {
  const r = await requireAuth(req);
  if (!r.ok) return r.response;
  const productId = Number(params.productId);
  if (!Number.isFinite(productId)) return NextResponse.json({ error: "BadId" }, { status: 400 });

  // Verify the product exists, isn't soft-deleted, and isn't orphaned
  // by a deleted store. Avoids cluttering favourites with ghosts.
  const exists = await prisma.product.findFirst({
    where: { productId, deletedAt: null, store: { deletedAt: null } },
    select: { productId: true },
  });
  if (!exists) return NextResponse.json({ error: "NotFound" }, { status: 404 });

  await prisma.productFavorite.upsert({
    where: { userId_productId: { userId: r.auth.uid, productId } },
    update: {},
    create: { userId: r.auth.uid, productId },
  });
  return NextResponse.json({ ok: true, favorited: true });
}

/** DELETE → unheart. Silent no-op if it wasn't favourited. */
export async function DELETE(req: NextRequest, { params }: { params: { productId: string } }) {
  const r = await requireAuth(req);
  if (!r.ok) return r.response;
  const productId = Number(params.productId);
  if (!Number.isFinite(productId)) return NextResponse.json({ error: "BadId" }, { status: 400 });

  await prisma.productFavorite.deleteMany({
    where: { userId: r.auth.uid, productId },
  });
  return NextResponse.json({ ok: true, favorited: false });
}
