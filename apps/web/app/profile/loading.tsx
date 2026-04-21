import { TopNav } from "@/components/TopNav";
import { Footer } from "@/components/Footer";
import { Skeleton } from "@/components/Skeleton";

export default function ProfileLoading() {
  return (
    <>
      <TopNav />
      <main className="mx-auto max-w-[900px] px-6 md:px-10 py-10">
        <div className="rounded-2xl glass-morphism p-6 mb-6 flex items-center gap-5">
          <Skeleton className="h-24 w-24 rounded-2xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-7 w-56" />
            <Skeleton className="h-4 w-72" />
            <Skeleton className="h-3 w-40" />
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="rounded-2xl glass-morphism p-5 space-y-3">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-3/4" />
          </div>
          <div className="rounded-2xl glass-morphism p-5 space-y-3">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
