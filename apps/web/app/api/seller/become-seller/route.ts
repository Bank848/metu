import { NextResponse, type NextRequest } from "next/server";
import { becomeSellerSchema } from "@metu/shared";
import { prisma } from "@/lib/server/prisma";
import { requireAuth } from "@/lib/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const r = await requireAuth(req);
  if (!r.ok) return r.response;
  const body = await req.json().catch(() => ({}));
  const parsed = becomeSellerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "ValidationError", details: parsed.error.flatten() }, { status: 400 });
  }
  const existing = await prisma.store.findUnique({ where: { ownerId: r.auth.uid } });
  if (existing) return NextResponse.json({ error: "StoreExists", storeId: existing.storeId }, { status: 409 });

  const store = await prisma.$transaction(async (tx) => {
    const store = await tx.store.create({
      data: {
        ownerId: r.auth.uid,
        businessTypeId: parsed.data.businessTypeId,
        name: parsed.data.name,
        description: parsed.data.description,
        profileImage: parsed.data.profileImage,
        coverImage: parsed.data.coverImage,
        stats: { create: {} },
      },
      include: { stats: true },
    });
    await tx.userStats.upsert({
      where: { userId: r.auth.uid },
      update: { role: "seller" },
      create: { userId: r.auth.uid, role: "seller" },
    });
    return store;
  });
  return NextResponse.json(store);
}
