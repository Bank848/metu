import { TopNav } from "@/components/TopNav";
import { Footer } from "@/components/Footer";
import { Skeleton, ProductGridSkeleton } from "@/components/Skeleton";

export default function HomeLoading() {
  return (
    <>
      <TopNav />
      <main>
        <section className="relative overflow-hidden bg-hero-radial min-h-[680px]">
          <div className="relative mx-auto max-w-[1440px] px-6 md:px-10 pt-20 grid md:grid-cols-2 gap-10 items-center">
            <div className="space-y-5">
              <Skeleton className="h-6 w-44 rounded-full" />
              <Skeleton className="h-16 w-72" />
              <Skeleton className="h-16 w-96" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
              <div className="flex gap-3 pt-2">
                <Skeleton className="h-12 w-40 rounded-full" />
                <Skeleton className="h-12 w-40 rounded-full" />
              </div>
            </div>
          </div>
          <div className="relative mx-auto max-w-[1440px] px-6 md:px-10 pb-12 grid grid-cols-2 md:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-2xl" />
            ))}
          </div>
        </section>
        <section className="mx-auto max-w-[1440px] px-6 md:px-10 py-16">
          <Skeleton className="h-8 w-44 mb-8" />
          <ProductGridSkeleton count={8} />
        </section>
      </main>
      <Footer />
    </>
  );
}
