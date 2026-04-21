import { NextResponse, type NextRequest } from "next/server";
import { updateStoreSchema } from "@metu/shared";
import { prisma } from "@/lib/server/prisma";
import { withStore } from "@/lib/server/seller";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PATCH /api/seller/store — update the authed seller's own store.
 *
 * Fills the gap that `/seller/store/edit` was POSTing to but no route
 * existed for (resulting in a 405/404 surfaced as "Failed to save
 * store"). Reuses the existing `updateStoreSchema` from the shared
 * package, which is `becomeSellerSchema.partial()` — every field is
 * optional so the form can send just what changed.
 */
export async function PATCH(req: NextRequest) {
  const r = await withStore(req);
  if (!r.ok) return r.response;

  const body = await req.json().catch(() => ({}));
  const parsed = updateStoreSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "ValidationError", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // Build an update payload that only includes keys the client actually
  // sent. Sending `undefined` via Prisma is a no-op but we also want to
  // allow the caller to blank out an image by sending `null` — support
  // both patterns.
  const data: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) data.name = parsed.data.name;
  if (parsed.data.description !== undefined) data.description = parsed.data.description;
  if (parsed.data.businessTypeId !== undefined) data.businessTypeId = parsed.data.businessTypeId;
  if (parsed.data.profileImage !== undefined) data.profileImage = parsed.data.profileImage;
  if (parsed.data.coverImage !== undefined) data.coverImage = parsed.data.coverImage;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ ok: true, noop: true });
  }

  const updated = await prisma.store.update({
    where: { storeId: r.store.storeId },
    data,
    include: { businessType: true },
  });
  return NextResponse.json({ ok: true, store: updated });
}

/** GET /api/seller/store — current seller's store (handy for client hydrate). */
export async function GET(req: NextRequest) {
  const r = await withStore(req);
  if (!r.ok) return r.response;
  const store = await prisma.store.findUnique({
    where: { storeId: r.store.storeId },
    include: { businessType: true, stats: true },
  });
  return NextResponse.json(store);
}
