import { TopNav } from "@/components/TopNav";
import { Footer } from "@/components/Footer";
import { Skeleton } from "@/components/Skeleton";

export default function OrdersLoading() {
  return (
    <>
      <TopNav />
      <main id="main" className="mx-auto max-w-[1200px] px-6 md:px-10 py-10">
        <div className="mb-8 space-y-2">
          <Skeleton className="h-9 w-56" />
          <Skeleton className="h-4 w-72" />
        </div>
        <ul className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <li key={i} className="rounded-2xl glass-morphism p-5">
              <div className="flex items-center justify-between mb-3">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <div className="flex gap-3">
                <Skeleton className="h-14 w-14 rounded-xl" />
                <Skeleton className="h-14 w-14 rounded-xl" />
                <Skeleton className="h-14 w-14 rounded-xl" />
              </div>
              <div className="mt-4 flex items-center justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-6 w-20" />
              </div>
            </li>
          ))}
        </ul>
      </main>
      <Footer />
    </>
  );
}
