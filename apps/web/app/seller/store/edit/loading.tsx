import { Skeleton } from "@/components/Skeleton";

/** skeleton for /seller/store/edit storefront editor. */
export default function SellerStoreEditLoading() {
  return (
    <div className="max-w-2xl">
      <div className="mb-6 space-y-2">
        <Skeleton className="h-9 w-44" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="rounded-2xl glass-morphism p-5 space-y-4 mb-5">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <div className="flex items-end gap-4">
          <Skeleton className="h-20 w-20 rounded-full -mt-12 ml-2" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-10 w-full rounded-md" />
          </div>
        </div>
      </div>
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="rounded-2xl glass-morphism p-5 space-y-4 mb-5">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-24 w-full rounded-md" />
        </div>
      ))}
      <div className="flex justify-end">
        <Skeleton className="h-10 w-32 rounded-full" />
      </div>
    </div>
  );
}
