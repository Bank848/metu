import { TopNav } from "@/components/TopNav";
import { Footer } from "@/components/Footer";
import { Skeleton } from "@/components/Skeleton";

export default function MyReviewsLoading() {
  return (
    <>
      <TopNav />
      <main id="main" className="mx-auto max-w-[1100px] px-6 md:px-10 py-10">
        <div className="mb-8 space-y-2">
          <Skeleton className="h-9 w-56" />
          <Skeleton className="h-4 w-72" />
        </div>
        <ul className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <li key={i} className="rounded-2xl glass-morphism p-5">
              <div className="flex gap-4">
                <Skeleton className="h-20 w-20 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-4 w-3/5" />
                  <Skeleton className="h-3 w-1/4" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-5/6" />
                </div>
              </div>
            </li>
          ))}
        </ul>
      </main>
      <Footer />
    </>
  );
}
