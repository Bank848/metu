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
