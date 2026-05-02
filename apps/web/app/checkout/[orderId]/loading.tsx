import { TopNav } from "@/components/TopNav";
import { Skeleton } from "@/components/Skeleton";

/**
 * Phase 47 — skeleton for /checkout/[orderId]. Header + a card-shaped
 * placeholder so the buyer doesn't see a blank page while Stripe
 * Elements mounts.
 */
export default function CheckoutLoading() {
  return (
    <>
      <TopNav />
      <main id="main" className="mx-auto max-w-2xl px-6 py-12">
        <Skeleton className="h-9 w-72 mb-2" />
        <Skeleton className="h-4 w-48 mb-8" />
        <div className="rounded-2xl border border-line bg-space-900 p-6 space-y-4">
          <Skeleton className="h-12 w-full rounded-md" />
          <Skeleton className="h-12 w-full rounded-md" />
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-12 w-full rounded-md" />
            <Skeleton className="h-12 w-full rounded-md" />
          </div>
          <Skeleton className="h-12 w-full rounded-md" />
          <Skeleton className="h-12 w-full rounded-full mt-4" />
        </div>
      </main>
    </>
  );
}
