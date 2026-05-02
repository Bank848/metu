import { TopNav } from "@/components/TopNav";
import { Skeleton, ProductGridSkeleton } from "@/components/Skeleton";

/** Phase 47 — skeleton for /favorites. Reuses ProductGridSkeleton. */
export default function FavoritesLoading() {
  return (
    <>
      <TopNav />
      <main id="main" className="mx-auto max-w-6xl px-6 md:px-8 py-10">
        <div className="mb-6 space-y-2">
          <Skeleton className="h-9 w-44" />
          <Skeleton className="h-4 w-72" />
        </div>
        <ProductGridSkeleton count={8} />
      </main>
    </>
  );
}
