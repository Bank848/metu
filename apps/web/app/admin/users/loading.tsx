import {
  PageHeaderSkeleton,
  FilterBarSkeleton,
  DataTableSkeleton,
} from "@/components/Skeleton";

export default function AdminUsersLoading() {
  return (
    <div>
      <PageHeaderSkeleton />
      <FilterBarSkeleton pillWidths={["w-32", "w-20"]} />
      <DataTableSkeleton
        hasAvatar
        cols={["w-40", "w-20", "w-16", "w-24", "w-20"]}
        rows={8}
      />
    </div>
  );
}
