import { NextResponse, type NextRequest } from "next/server";
import { couponInputSchema } from "@metu/shared";
import { prisma } from "@/lib/server/prisma";
import { withStore } from "@/lib/server/seller";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const r = await withStore(req);
  if (!r.ok) return r.response;
  const coupons = await prisma.coupon.findMany({
    where: { storeId: r.store.storeId },
    orderBy: { couponId: "desc" },
    include: { _count: { select: { usages: true } } },
  });
  return NextResponse.json(coupons);
}

export async function POST(req: NextRequest) {
  const r = await withStore(req);
  if (!r.ok) return r.response;
  const body = await req.json().catch(() => ({}));
  const parsed = couponInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "ValidationError", details: parsed.error.flatten() }, { status: 400 });
  }
  const created = await prisma.coupon.create({
    data: {
      storeId: r.store.storeId,
      code: parsed.data.code,
      discountType: parsed.data.discountType,
      discountValue: parsed.data.discountValue,
      startDate: new Date(parsed.data.startDate),
      endDate: new Date(parsed.data.endDate),
      usageLimit: parsed.data.usageLimit,
      isActive: parsed.data.isActive,
    },
  });
  return NextResponse.json(created);
}
