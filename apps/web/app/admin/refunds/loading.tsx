import { Skeleton } from "@/components/Skeleton";

/**
 * Phase 47 — skeleton for /admin/refunds list table. Same shape as
 * audit/users — toolbar + ~8 row strips.
 */
export default function AdminRefundsLoading() {
  return (
    <div>
      <div className="mb-6 space-y-2">
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-4 w-80" />
      </div>
      <div className="surface-flat rounded-xl overflow-hidden">
        <div className="border-b border-white/8 px-4 py-3 flex gap-6">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-3 w-20" />
          ))}
        </div>
        {Array.from({ length: 8 }).map((_, r) => (
          <div key={r} className="border-b border-white/5 px-4 py-4 flex items-center gap-6">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-44 flex-1" />
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-8 w-24 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
