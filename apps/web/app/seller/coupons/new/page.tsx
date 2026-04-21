import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { getMe } from "@/lib/session";
import { NewCouponForm } from "./NewCouponForm";

export const dynamic = "force-dynamic";

export default async function NewCouponPage() {
  const me = await getMe();
  if (!me) redirect("/login?next=/seller/coupons/new");
  if (!me.user?.store && me.role !== "admin") redirect("/become-seller");

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
        title="New coupon"
        subtitle="Create a discount code your buyers can apply at checkout."
      />
      <NewCouponForm />
    </>
  );
}
