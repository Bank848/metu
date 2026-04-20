import { NextResponse, type NextRequest } from "next/server";
import { validateCouponSchema } from "@metu/shared";
import { prisma } from "@/lib/server/prisma";
import { requireAuth } from "@/lib/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const r = await requireAuth(req);
  if (!r.ok) return r.response;
  const body = await req.json().catch(() => ({}));
  const parsed = validateCouponSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ valid: false, reason: "Invalid request" });
  const coupon = await prisma.coupon.findFirst({
    where: { code: parsed.data.code, isActive: true },
    include: { store: { select: { storeId: true, name: true } } },
  });
  if (!coupon) return NextResponse.json({ valid: false, reason: "Coupon not found or inactive" });
  const now = new Date();
  if (now < coupon.startDate) return NextResponse.json({ valid: false, reason: "Coupon is not yet active" });
  if (now > coupon.endDate)   return NextResponse.json({ valid: false, reason: "Coupon has expired" });
  const used = await prisma.couponUsage.count({ where: { couponId: coupon.couponId } });
  if (used >= coupon.usageLimit) return NextResponse.json({ valid: false, reason: "Coupon usage limit reached" });
  return NextResponse.json({
    valid: true,
    code: coupon.code,
    couponId: coupon.couponId,
    discountType: coupon.discountType,
    discountValue: coupon.discountValue,
    store: coupon.store,
  });
}
