import { TopNav } from "@/components/TopNav";
import { Footer } from "@/components/Footer";
import { Skeleton } from "@/components/Skeleton";

export default function OrderDetailLoading() {
  return (
    <>
      <TopNav />
      <main id="main" className="mx-auto max-w-[960px] px-6 md:px-10 py-10">
        <Skeleton className="h-4 w-24 mb-4" />
        <div className="rounded-2xl glass-morphism p-6 space-y-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
          <Skeleton className="h-3 w-72" />
          <div className="border-t border-white/8 pt-4 space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-16 w-16 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/5" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
                <Skeleton className="h-6 w-20" />
              </div>
            ))}
          </div>
          <div className="border-t border-white/8 pt-4 flex items-center justify-between">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-7 w-28" />
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
