import { TopNav } from "@/components/TopNav";
import { Skeleton } from "@/components/Skeleton";

/** Phase 47 — skeleton for /compare side-by-side product comparison. */
export default function CompareLoading() {
  return (
    <>
      <TopNav />
      <main id="main" className="mx-auto max-w-6xl px-6 md:px-8 py-10">
        <div className="mb-6 space-y-2">
          <Skeleton className="h-9 w-44" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-2xl glass-morphism overflow-hidden">
              <Skeleton className="aspect-[4/3] rounded-none" />
              <div className="p-4 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-5 w-20" />
                <div className="space-y-1.5 pt-2">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <Skeleton key={j} className="h-3 w-full" />
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </>
  );
}
