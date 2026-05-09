import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { getMe } from "@/lib/session";
import { prisma } from "@/lib/server/prisma";
import { CouponForm, type CouponFormInitial } from "../../CouponForm";

export const dynamic = "force-dynamic";

function isoLocal(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default async function EditCouponPage({ params }: { params: { id: string } }) {
  const me = await getMe();
  if (!me) redirect(`/login?next=/seller/coupons/${params.id}/edit`);
  if (!me.user?.store && me.role !== "admin") redirect("/become-seller");

  const couponId = Number(params.id);
  if (!Number.isFinite(couponId)) return notFound();

  const coupon = await prisma.coupon.findUnique({ where: { couponId } });
  if (!coupon) return notFound();
  if (me.role !== "admin" && coupon.storeId !== me.user.store?.storeId) return notFound();

  const initial: CouponFormInitial = {
    code: coupon.code,
    discountType: coupon.discountType as "percent" | "fixed",
    discountValue: coupon.discountValue,
    startDate: isoLocal(coupon.startDate),
    endDate: isoLocal(coupon.endDate),
    usageLimit: coupon.usageLimit,
    isActive: coupon.isActive,
  };

  return (
    <>
      <Link
        href="/seller/coupons"
        className="inline-flex items-center gap-1.5 text-sm text-ink-dim hover:text-metu-yellow mb-3"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to coupons
      </Link>
      <PageHeader
        title={`Edit "${coupon.code}"`}
        subtitle="Tweak the discount window or pause it without losing the redemption history."
      />
      <CouponForm mode="edit" couponId={couponId} initial={initial} />
    </>
  );
}
