import { Skeleton } from "@/components/Skeleton";

/**
 * Phase 47 — skeleton for /seller/coupons list. Header + new-coupon
 * CTA + table of coupons.
 */
export default function SellerCouponsLoading() {
  return (
    <div>
      <div className="mb-6 flex items-end justify-between gap-4">
        <div className="space-y-2 flex-1">
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-10 w-32 rounded-full" />
      </div>
      <div className="surface-flat rounded-xl overflow-hidden">
        <div className="border-b border-white/8 px-4 py-3 flex gap-6">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-3 w-20" />
          ))}
        </div>
        {Array.from({ length: 6 }).map((_, r) => (
          <div key={r} className="border-b border-white/5 px-4 py-3 flex items-center gap-6">
            <Skeleton className="h-6 w-24 rounded-md" />
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-12 ml-auto" />
            <Skeleton className="h-8 w-8 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}
