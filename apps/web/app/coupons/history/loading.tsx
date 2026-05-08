import {
  PageHeaderSkeleton,
  DataTableSkeleton,
} from "@/components/Skeleton";

export default function CouponsHistoryLoading() {
  return (
    <div>
      <PageHeaderSkeleton />
      <DataTableSkeleton
        cols={["w-32", "w-24", "w-20", "w-16", "w-32"]}
        rows={6}
      />
    </div>
  );
}
