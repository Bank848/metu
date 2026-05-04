import { Skeleton } from "@/components/Skeleton";

/**
 * skeleton for /seller/wallet. Big balance card + payout
 * history table. Stripe payout fetches typically take 200-600ms cold,
 * so a real skeleton helps.
 */
export default function SellerWalletLoading() {
  return (
    <div>
      <div className="mb-6 space-y-2">
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="rounded-3xl surface-editorial p-8 mb-6 space-y-3">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-12 w-56" />
        <Skeleton className="h-3 w-40" />
        <div className="pt-2 flex gap-2">
          <Skeleton className="h-10 w-32 rounded-full" />
          <Skeleton className="h-10 w-32 rounded-full" />
        </div>
      </div>
      <Skeleton className="h-5 w-40 mb-3" />
      <div className="surface-flat rounded-xl overflow-hidden">
        {Array.from({ length: 6 }).map((_, r) => (
          <div key={r} className="border-b border-white/5 px-4 py-3 flex items-center gap-6">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-32 flex-1" />
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
