import { cn } from "@/lib/utils";

/** Single skeleton block with shimmer. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-md bg-white/[0.04]",
        "before:absolute before:inset-0",
        "before:bg-gradient-to-r before:from-transparent before:via-white/[0.06] before:to-transparent",
        "before:animate-[shimmer_1.5s_infinite]",
        className,
      )}
      style={{ backgroundSize: "200% 100%" }}
    />
  );
}

/** Skeleton card matching ProductCard shape. */
export function ProductCardSkeleton() {
  return (
    <div className="rounded-2xl glass-morphism overflow-hidden">
      <Skeleton className="aspect-[4/3] rounded-none" />
      <div className="p-4 space-y-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <div className="flex justify-between items-center pt-2">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-3 w-12" />
        </div>
      </div>
    </div>
  );
}

/** Grid of N product card skeletons. */
export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}

/** Page title + subtitle pair shown above content. */
export function PageHeaderSkeleton({
  titleWidth = "w-32",
  subtitleWidth = "w-72",
}: {
  titleWidth?: string;
  subtitleWidth?: string;
}) {
  return (
    <div className="mb-8 space-y-2">
      <Skeleton className={cn("h-9", titleWidth)} />
      <Skeleton className={cn("h-4", subtitleWidth)} />
    </div>
  );
}

/** Search input + N filter pills row. */
export function FilterBarSkeleton({
  pillWidths = ["w-32", "w-20"],
}: {
  pillWidths?: string[];
}) {
  return (
    <div className="mb-4 flex gap-2">
      <Skeleton className="h-10 flex-1 rounded-full" />
      {pillWidths.map((w, i) => (
        <Skeleton key={i} className={cn("h-10 rounded-full", w)} />
      ))}
    </div>
  );
}

/** Grid of N KPI tiles (label + big number). */
export function KpiTilesSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="surface-flat rounded-2xl p-5 space-y-3">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-7 w-20" />
        </div>
      ))}
    </div>
  );
}

/** Header row + N data rows. `cols` is an array of bar widths per column. */
export function DataTableSkeleton({
  rows = 8,
  cols = ["w-24", "w-20", "w-16", "w-24", "w-20"],
  hasAvatar = false,
}: {
  rows?: number;
  cols?: string[];
  hasAvatar?: boolean;
}) {
  return (
    <div className="surface-flat rounded-xl overflow-hidden">
      <div className="border-b border-white/8 px-4 py-3 flex gap-6">
        {cols.map((_, i) => (
          <Skeleton key={i} className="h-3 w-24" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div
          key={r}
          className="border-b border-white/5 px-4 py-4 flex items-center gap-6"
        >
          {hasAvatar ? (
            <div className="flex items-center gap-3 flex-1">
              <Skeleton className="h-9 w-9 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          ) : null}
          {cols.map((w, i) => (
            <Skeleton key={i} className={cn("h-3", w)} />
          ))}
        </div>
      ))}
    </div>
  );
}
