import { TopNav } from "@/components/TopNav";
import { Skeleton } from "@/components/Skeleton";

/** skeleton for /profile/sessions table. */
export default function ProfileSessionsLoading() {
  return (
    <>
      <TopNav />
      <main id="main" className="mx-auto max-w-3xl px-6 md:px-8 py-10">
        <div className="mb-6 space-y-2">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="rounded-2xl glass-morphism overflow-hidden">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="border-b border-white/5 px-5 py-4 flex items-center gap-4">
              <Skeleton className="h-10 w-10 rounded-md shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-44" />
                <Skeleton className="h-3 w-64" />
              </div>
              <Skeleton className="h-9 w-24 rounded-full" />
            </div>
          ))}
        </div>
      </main>
    </>
  );
}
