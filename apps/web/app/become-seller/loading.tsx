import { TopNav } from "@/components/TopNav";
import { Skeleton } from "@/components/Skeleton";

/** skeleton for /become-seller onboarding form. */
export default function BecomeSellerLoading() {
  return (
    <>
      <TopNav />
      <main id="main" className="mx-auto max-w-2xl px-6 md:px-8 py-10">
        <div className="mb-6 space-y-2">
          <Skeleton className="h-9 w-56" />
          <Skeleton className="h-4 w-80" />
        </div>
        <div className="rounded-2xl glass-morphism p-6 space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-10 w-full rounded-md" />
            </div>
          ))}
          <div className="flex justify-end pt-3">
            <Skeleton className="h-10 w-32 rounded-full" />
          </div>
        </div>
      </main>
    </>
  );
}
