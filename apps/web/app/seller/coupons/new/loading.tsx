import { Skeleton } from "@/components/Skeleton";

/** Phase 47 — skeleton for /seller/coupons/new form. */
export default function SellerCouponsNewLoading() {
  return (
    <div className="max-w-xl">
      <div className="mb-6 space-y-2">
        <Skeleton className="h-9 w-44" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="rounded-2xl glass-morphism p-5 space-y-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-10 w-full rounded-md" />
          </div>
        ))}
        <div className="flex justify-end gap-2 pt-3">
          <Skeleton className="h-10 w-24 rounded-full" />
          <Skeleton className="h-10 w-32 rounded-full" />
        </div>
      </div>
    </div>
  );
}
