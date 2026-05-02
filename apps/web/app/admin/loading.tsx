import { Skeleton } from "@/components/Skeleton";

/**
 * Phase 47 — skeleton for /admin overview. Mirrors the editorial hero,
 * 4-stat KPI grid, and chart + recent-transactions split that the live
 * page renders, so navigation from the sidebar doesn't flash a blank
 * frame while admin/stats fetches.
 */
export default function AdminOverviewLoading() {
  return (
    <div>
      <div className="surface-editorial rounded-3xl px-6 py-6 md:px-8 md:py-8 mb-6 space-y-2">
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-4 w-96" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl glass-morphism p-5 space-y-3">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-7 w-24" />
            <Skeleton className="h-3 w-20" />
          </div>
        ))}
      </div>
      <div className="grid lg:grid-cols-[1fr_380px] gap-6">
        <div className="rounded-2xl glass-morphism p-5 space-y-4">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
        <div className="rounded-2xl glass-morphism p-5 space-y-3">
          <Skeleton className="h-5 w-40" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex gap-3 items-center">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
              <Skeleton className="h-3 w-12" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
