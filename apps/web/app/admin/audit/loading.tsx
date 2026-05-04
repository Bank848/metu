import { Skeleton } from "@/components/Skeleton";

/**
 * skeleton for /admin/audit. Filter row + 10 audit-event
 * rows so the table reserves the right vertical space and pagination
 * doesn't pop in.
 */
export default function AdminAuditLoading() {
  return (
    <div>
      <div className="mb-6 space-y-2">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        <Skeleton className="h-10 flex-1 min-w-48 rounded-full" />
        <Skeleton className="h-10 w-40 rounded-full" />
        <Skeleton className="h-10 w-40 rounded-full" />
        <Skeleton className="h-10 w-20 rounded-full" />
      </div>
      <div className="surface-flat rounded-xl overflow-hidden">
        {Array.from({ length: 10 }).map((_, r) => (
          <div key={r} className="border-b border-white/5 px-4 py-3 flex items-center gap-4">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-3 w-40 flex-1" />
            <Skeleton className="h-3 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}
