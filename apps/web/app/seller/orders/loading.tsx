import { Skeleton } from "@/components/Skeleton";

/**
 * Phase 47 — skeleton for /seller/orders. Toolbar + 8 order rows
 * (ID, buyer, items, total, status badge, action menu).
 */
export default function SellerOrdersLoading() {
  return (
    <div>
      <div className="mb-6 space-y-2">
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        <Skeleton className="h-10 flex-1 min-w-48 rounded-full" />
        <Skeleton className="h-10 w-32 rounded-full" />
      </div>
      <div className="surface-flat rounded-xl overflow-hidden">
        <div className="border-b border-white/8 px-4 py-3 flex gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-3 w-20" />
          ))}
        </div>
        {Array.from({ length: 8 }).map((_, r) => (
          <div key={r} className="border-b border-white/5 px-4 py-3 flex items-center gap-6">
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-3 w-32 flex-1" />
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-8 w-8 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}
