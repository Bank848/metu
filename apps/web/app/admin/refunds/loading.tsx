import {
  PageHeaderSkeleton,
  DataTableSkeleton,
} from "@/components/Skeleton";

export default function AdminRefundsLoading() {
  return (
    <div>
      <PageHeaderSkeleton subtitleWidth="w-80" />
      <DataTableSkeleton cols={["w-20", "w-44", "w-16", "w-24", "w-24"]} rows={8} />
    </div>
  );
}
