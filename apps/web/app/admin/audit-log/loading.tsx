import {
  PageHeaderSkeleton,
  KpiTilesSkeleton,
  DataTableSkeleton,
} from "@/components/Skeleton";

export default function AdminAuditLogLoading() {
  return (
    <div>
      <PageHeaderSkeleton />
      <KpiTilesSkeleton count={3} />
      <DataTableSkeleton
        cols={["w-32", "w-24", "w-20", "w-16", "w-32"]}
        rows={8}
      />
    </div>
  );
}
