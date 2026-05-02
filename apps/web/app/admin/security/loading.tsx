import { Skeleton } from "@/components/Skeleton";

export default function AdminSecurityLoading() {
  return (
    <div>
      <div className="mb-6 space-y-2">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-4 w-96" />
      </div>
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
