import { Skeleton } from "@/components/Skeleton";

/**
 * skeleton for /admin/changelog. Vertical timeline of
 * release entries. Live page renders ~30 phases so we approximate
 * the first 6 here to occupy the visible viewport.
 */
export default function AdminChangelogLoading() {
  return (
    <div>
      <div className="mb-6 space-y-2">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="space-y-4 max-w-3xl">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-2xl glass-morphism p-5 space-y-3">
            <div className="flex items-center gap-3">
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-3 w-28" />
            </div>
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-5/6" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        ))}
      </div>
    </div>
  );
}
