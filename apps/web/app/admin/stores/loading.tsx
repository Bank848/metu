import { Skeleton } from "@/components/Skeleton";

/**
 * Phase 11 / F8 — Adds a Suspense boundary on /admin/stores so the
 * sidebar transition no longer leaves the previous segment (often
 * /admin/users) mounted while the Stores RSC payload streams in. The
 * skeleton shape mirrors the live page: PageHeader, three KPI tiles,
 * then a 6-column table.
 */
export default function AdminStoresLoading() {
  return (
    <div>
      <div className="mb-8 space-y-2">
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-4 w-72" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="surface-flat rounded-2xl p-5 space-y-3">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-7 w-20" />
          </div>
        ))}
      </div>

      <div className="surface-flat rounded-xl overflow-hidden">
        <div className="border-b border-white/8 px-4 py-3 flex gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-3 w-24" />
          ))}
        </div>
        {Array.from({ length: 6 }).map((_, r) => (
          <div key={r} className="border-b border-white/5 px-4 py-4 flex items-center gap-6">
            <div className="flex items-center gap-3 flex-1">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
            </div>
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-3 w-12" />
          </div>
        ))}
      </div>
    </div>
  );
}
