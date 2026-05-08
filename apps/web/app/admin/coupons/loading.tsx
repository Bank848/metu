import {
  PageHeaderSkeleton,
  KpiTilesSkeleton,
  DataTableSkeleton,
} from "@/components/Skeleton";

export default function AdminCouponsLoading() {
  return (
    <div>
      <PageHeaderSkeleton />
      <KpiTilesSkeleton count={4} />
      <DataTableSkeleton
        cols={["w-24", "w-16", "w-32", "w-12", "w-16", "w-12"]}
        rows={6}
      />
    </div>
  );
}
