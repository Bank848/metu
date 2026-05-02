import { Skeleton } from "@/components/Skeleton";

/**
 * Phase 47 — skeleton for /seller/products/[id]/edit. Same layout as
 * the New Product form so the user gets identical perceived weight
 * during navigation either direction.
 */
export default function SellerProductsEditLoading() {
  return (
    <div className="max-w-3xl">
      <div className="mb-6 space-y-2">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-4 w-80" />
      </div>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-2xl glass-morphism p-5 mb-5 space-y-4">
          <Skeleton className="h-5 w-44" />
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-10 w-full rounded-md" />
          </div>
          <Skeleton className="h-24 w-full rounded-md" />
        </div>
      ))}
      <div className="flex justify-end gap-2">
        <Skeleton className="h-10 w-24 rounded-full" />
        <Skeleton className="h-10 w-32 rounded-full" />
      </div>
    </div>
  );
}
