import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { CreateMasterCouponForm } from "./CreateMasterCouponForm";

export const metadata = { title: "New master coupon · Admin · METU" };
export const dynamic = "force-dynamic";

export default function NewMasterCouponPage() {
  return (
    <main className="px-8 py-8 max-w-2xl space-y-6">
      <Link href="/admin/coupons" className="inline-flex items-center gap-1.5 text-sm text-ink-dim hover:text-metu-yellow">
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to coupons
      </Link>
      <PageHeader
        title="New master coupon"
        subtitle="Master coupons apply platform-wide to any store. Use sparingly."
      />
      <CreateMasterCouponForm />
    </main>
  );
}
