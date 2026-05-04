import {
  PageHeaderSkeleton,
  FilterBarSkeleton,
  DataTableSkeleton,
} from "@/components/Skeleton";

export default function AdminAuditLoading() {
  return (
    <div>
      <PageHeaderSkeleton titleWidth="w-40" />
      <FilterBarSkeleton pillWidths={["w-40", "w-40", "w-20"]} />
      <DataTableSkeleton cols={["w-32", "w-28", "w-40", "w-24"]} rows={10} />
    </div>
  );
}
