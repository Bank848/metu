import {
  PageHeaderSkeleton,
  KpiTilesSkeleton,
  DataTableSkeleton,
} from "@/components/Skeleton";

export default function AdminStoresLoading() {
  return (
    <div>
      <PageHeaderSkeleton />
      <KpiTilesSkeleton count={3} />
      <DataTableSkeleton
        hasAvatar
        cols={["w-24", "w-16", "w-12", "w-12", "w-12"]}
        rows={6}
      />
    </div>
  );
}
