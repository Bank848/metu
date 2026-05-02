import { Skeleton } from "@/components/Skeleton";

export default function AdminTimelineLoading() {
  return (
    <div>
      <div className="mb-6 space-y-2">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-4 w-80" />
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        <Skeleton className="h-10 flex-1 min-w-64 rounded-full" />
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-7 w-24 rounded-full" />
        ))}
      </div>
      {Array.from({ length: 3 }).map((_, m) => (
        <div key={m} className="mb-8">
          <Skeleton className="h-6 w-32 rounded-full mb-3" />
          <div className="relative pl-4 pr-4 py-8">
            <div className="absolute left-0 right-0 top-1/2 h-px bg-white/10" />
            <div className="flex flex-wrap gap-3 items-center">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-52 rounded-xl" />
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
