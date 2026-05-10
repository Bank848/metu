import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { CreateMasterCouponForm } from "./CreateMasterCouponForm";
import { apiFetch } from "@/lib/server/api";

export const metadata = { title: "New coupon · Admin · METU" };
export const dynamic = "force-dynamic";

type StoreOption = { storeId: number; name: string; ownerName?: string };

async function fetchStoreOptions(): Promise<StoreOption[]> {
  try {
    const rows = await apiFetch<Array<{
      storeId: number;
      name: string;
      suspendedAt: string | null;
      owner?: { firstName: string; lastName: string; username: string };
    }>>("/admin/stores");
    return rows
      .filter((s) => !s.suspendedAt)
      .map((s) => ({
        storeId: s.storeId,
        name: s.name,
        ownerName: s.owner ? `${s.owner.firstName} ${s.owner.lastName}`.trim() : undefined,
      }));
  } catch {
    return [];
  }
}

export default async function NewCouponPage() {
  const stores = await fetchStoreOptions();
  return (
    <main className="px-8 py-8 max-w-2xl space-y-6">
      <Link href="/admin/coupons" className="inline-flex items-center gap-1.5 text-sm text-ink-dim hover:text-metu-yellow">
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to coupons
      </Link>
      <PageHeader
        title="New coupon"
        subtitle="Master coupons apply platform-wide. Store-scoped coupons only redeem on the chosen store."
      />
      <CreateMasterCouponForm stores={stores} />
    </main>
  );
}
