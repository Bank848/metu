import { Skeleton, PageHeaderSkeleton } from "@/components/Skeleton";

export default function AdminReportsLoading() {
  return (
    <div>
      <PageHeaderSkeleton />
      <div className="mb-4 flex gap-2">
        <Skeleton className="h-10 w-40 rounded-full" />
        <Skeleton className="h-10 w-40 rounded-full" />
      </div>
      <div className="space-y-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-2xl glass-morphism p-5 space-y-4">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-56 w-full rounded-xl" />
          </div>
        ))}
      </div>
    </div>
  );
}
