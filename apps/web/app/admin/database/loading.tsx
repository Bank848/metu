import { Skeleton, PageHeaderSkeleton, KpiTilesSkeleton } from "@/components/Skeleton";

export default function AdminDatabaseLoading() {
  return (
    <main className="px-8 py-8 max-w-6xl space-y-8">
      <PageHeaderSkeleton titleWidth="w-32" subtitleWidth="w-96" />
      <KpiTilesSkeleton count={4} />
      <Skeleton className="h-72 w-full rounded-2xl" />
      <Skeleton className="h-48 w-full rounded-2xl" />
      <Skeleton className="h-40 w-full rounded-2xl" />
    </main>
  );
}
