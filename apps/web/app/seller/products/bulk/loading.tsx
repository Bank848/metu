import { Skeleton } from "@/components/Skeleton";

/**
 * Phase 47 — skeleton for /seller/products/bulk price-adjust table.
 * Same row count as the live page tends to render so the layout
 * doesn't shift after fetch.
 */
export default function SellerProductsBulkLoading() {
  return (
    <div>
      <div className="mb-6 space-y-2">
        <Skeleton className="h-9 w-44" />
        <Skeleton className="h-4 w-80" />
      </div>
      <div className="surface-flat rounded-xl overflow-hidden">
        <div className="border-b border-white/8 px-4 py-3 flex gap-6">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-3 w-20" />
          ))}
        </div>
        {Array.from({ length: 10 }).map((_, r) => (
          <div key={r} className="border-b border-white/5 px-4 py-3 flex items-center gap-6">
            <Skeleton className="h-10 w-10 rounded-md shrink-0" />
            <Skeleton className="h-3 w-44 flex-1" />
            <Skeleton className="h-9 w-24 rounded-md" />
            <Skeleton className="h-9 w-24 rounded-md" />
            <Skeleton className="h-9 w-16 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}
