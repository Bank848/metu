import { Skeleton } from "@/components/Skeleton";

/**
 * skeleton for /admin/er-diagram. Big canvas placeholder
 * + the toolbar / shortcut row so the page doesn't jump when the
 * SVG mounts.
 */
export default function AdminErDiagramLoading() {
  return (
    <div>
      <div className="mb-6 space-y-2">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-4 w-80" />
      </div>
      <div className="mb-3 flex flex-wrap gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-20 rounded-md" />
        ))}
      </div>
      <Skeleton className="h-[600px] w-full rounded-2xl" />
    </div>
  );
}
