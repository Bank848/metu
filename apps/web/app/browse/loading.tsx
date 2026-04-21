import { TopNav } from "@/components/TopNav";
import { Footer } from "@/components/Footer";
import { Skeleton, ProductGridSkeleton } from "@/components/Skeleton";

export default function BrowseLoading() {
  return (
    <>
      <TopNav />
      <main className="mx-auto max-w-[1440px] px-6 md:px-10 py-10">
        <div className="mb-8 space-y-2">
          <Skeleton className="h-9 w-72" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid md:grid-cols-[260px_1fr] gap-8">
          <aside className="space-y-5">
            <Skeleton className="h-44 w-full rounded-2xl" />
            <Skeleton className="h-32 w-full rounded-2xl" />
            <Skeleton className="h-32 w-full rounded-2xl" />
          </aside>
          <ProductGridSkeleton count={8} />
        </div>
      </main>
      <Footer />
    </>
  );
}
