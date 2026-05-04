import { Skeleton, PageHeaderSkeleton } from "@/components/Skeleton";

export default function AdminSecurityLoading() {
  return (
    <div>
      <PageHeaderSkeleton titleWidth="w-48" subtitleWidth="w-96" />
      <Skeleton className="h-32 w-full rounded-2xl mb-6" />
      <div className="rounded-2xl border border-line overflow-hidden">
        <Skeleton className="h-10 w-full rounded-none" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-none border-t border-line" />
        ))}
      </div>
    </div>
  );
}
