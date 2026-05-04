import { Skeleton } from "@/components/Skeleton";

/** skeleton for the coupon usage report page. */
export default function SellerCouponReportLoading() {
  return (
    <div>
      <div className="mb-6 space-y-2">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl glass-morphism p-5 space-y-3">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-7 w-24" />
          </div>
        ))}
      </div>
      <div className="rounded-2xl glass-morphism p-5 space-y-4">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-56 w-full rounded-xl" />
      </div>
    </div>
  );
}
