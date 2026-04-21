import { TopNav } from "@/components/TopNav";
import { Footer } from "@/components/Footer";
import { Skeleton, ProductGridSkeleton } from "@/components/Skeleton";

export default function StoreLoading() {
  return (
    <>
      <TopNav />
      <main>
        <section className="relative h-[280px] md:h-[360px] vibrant-mesh" />
        <div className="mx-auto max-w-[1280px] px-6 md:px-10 -mt-20 relative">
          <div className="flex flex-col md:flex-row md:items-end gap-6 mb-10">
            <Skeleton className="h-32 w-32 rounded-2xl" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-5 w-32 rounded-full" />
              <Skeleton className="h-10 w-72" />
              <Skeleton className="h-4 w-96" />
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-7 w-44 mb-6" />
          <ProductGridSkeleton count={8} />
        </div>
      </main>
      <Footer />
    </>
  );
}
