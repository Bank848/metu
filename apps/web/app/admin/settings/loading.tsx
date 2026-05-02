import { Skeleton } from "@/components/Skeleton";

/**
 * Phase 47 — skeleton for /admin/settings. Stack of toggle/form cards
 * matching the live page's section layout (favourites, chat, fees,
 * etc.).
 */
export default function AdminSettingsLoading() {
  return (
    <div>
      <div className="mb-6 space-y-2">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="space-y-5 max-w-2xl">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl glass-morphism p-5 space-y-4">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-3 w-72" />
            <div className="flex items-center justify-between gap-4">
              <Skeleton className="h-3 w-40" />
              <Skeleton className="h-6 w-12 rounded-full" />
            </div>
            <div className="flex items-center justify-between gap-4">
              <Skeleton className="h-3 w-40" />
              <Skeleton className="h-9 w-24 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
