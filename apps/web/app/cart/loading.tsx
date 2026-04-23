import { TopNav } from "@/components/TopNav";
import { Footer } from "@/components/Footer";
import { Skeleton } from "@/components/Skeleton";

export default function CartLoading() {
  return (
    <>
      <TopNav />
      <main id="main" className="mx-auto max-w-[1200px] px-6 md:px-10 py-10">
        <Skeleton className="h-9 w-48 mb-8" />
        <div className="grid lg:grid-cols-[1fr_360px] gap-8">
          <div className="space-y-4">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="rounded-2xl glass-morphism p-4 flex items-center gap-4">
                <Skeleton className="h-20 w-20 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
                <Skeleton className="h-6 w-20" />
              </div>
            ))}
          </div>
          <aside className="rounded-2xl glass-morphism p-5 space-y-3 h-fit">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-10 w-full rounded-xl" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-2/3" />
            <Skeleton className="h-12 w-full rounded-xl" />
          </aside>
        </div>
      </main>
      <Footer />
    </>
  );
}
