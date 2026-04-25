import { Skeleton } from "@/components/Skeleton";

/**
 * Phase 11 / F8 — Mirrors the new /admin/stores boundary so a sidebar
 * navigation in the OTHER direction (Stores → Users) doesn't repeat
 * the same stale-segment flash. The Suspense wrapper kicks in on each
 * navigation, freeing Next from showing the prior page's contents
 * during the RSC fetch.
 */
export default function AdminUsersLoading() {
  return (
    <div>
      <div className="mb-8 space-y-2">
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-4 w-72" />
      </div>

      {/* Search bar */}
      <div className="mb-4 flex gap-2">
        <Skeleton className="h-10 flex-1 rounded-full" />
        <Skeleton className="h-10 w-32 rounded-full" />
        <Skeleton className="h-10 w-20 rounded-full" />
      </div>

      <div className="surface-flat rounded-xl overflow-hidden">
        <div className="border-b border-white/8 px-4 py-3 flex gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-3 w-24" />
          ))}
        </div>
        {Array.from({ length: 8 }).map((_, r) => (
          <div key={r} className="border-b border-white/5 px-4 py-4 flex items-center gap-6">
            <div className="flex items-center gap-3 flex-1">
              <Skeleton className="h-9 w-9 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
            <Skeleton className="h-3 w-40" />
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}
