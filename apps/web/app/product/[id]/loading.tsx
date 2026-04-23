import { TopNav } from "@/components/TopNav";
import { Footer } from "@/components/Footer";
import { Skeleton } from "@/components/Skeleton";

export default function ProductLoading() {
  return (
    <>
      <TopNav />
      <main id="main" className="mx-auto max-w-[1440px] px-6 md:px-10 py-10">
        <Skeleton className="h-3 w-72 mb-6" />
        <div className="grid md:grid-cols-[1.15fr_1fr] gap-10">
          <div className="space-y-3">
            <Skeleton className="aspect-[4/3] w-full rounded-2xl" />
            <div className="grid grid-cols-4 gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="aspect-square rounded-xl" />
              ))}
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-3/4" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full rounded-2xl" />
            <Skeleton className="h-44 w-full rounded-2xl" />
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
