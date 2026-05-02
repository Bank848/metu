import { Skeleton } from "@/components/Skeleton";

/**
 * Phase 47 — skeleton for the seller New Product form. Stack of
 * form-section cards mirroring the live layout (basics, images,
 * variants, tags).
 */
export default function SellerProductsNewLoading() {
  return (
    <div className="max-w-3xl">
      <div className="mb-6 space-y-2">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-4 w-80" />
      </div>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-2xl glass-morphism p-5 mb-5 space-y-4">
          <Skeleton className="h-5 w-44" />
          <Skeleton className="h-3 w-72" />
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-10 w-full rounded-md" />
            </div>
            <div className="space-y-1.5">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-10 w-full rounded-md" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-24 w-full rounded-md" />
          </div>
        </div>
      ))}
      <div className="flex justify-end gap-2">
        <Skeleton className="h-10 w-24 rounded-full" />
        <Skeleton className="h-10 w-32 rounded-full" />
      </div>
    </div>
  );
}
