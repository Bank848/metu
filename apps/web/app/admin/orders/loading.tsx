import {
  PageHeaderSkeleton,
  KpiTilesSkeleton,
  DataTableSkeleton,
} from "@/components/Skeleton";

export default function AdminOrdersLoading() {
  return (
    <div>
      <PageHeaderSkeleton />
      <KpiTilesSkeleton count={4} />
      <DataTableSkeleton
        hasAvatar
        cols={["w-16", "w-32", "w-20", "w-16", "w-24"]}
        rows={8}
      />
    </div>
  );
}
