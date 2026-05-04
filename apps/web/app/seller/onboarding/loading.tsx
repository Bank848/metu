import { Skeleton } from "@/components/Skeleton";

/** skeleton for /seller/onboarding Stripe-Connect status page. */
export default function SellerOnboardingLoading() {
  return (
    <div className="max-w-2xl">
      <div className="mb-6 space-y-2">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-4 w-80" />
      </div>
      <div className="rounded-2xl glass-morphism p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-44" />
            <Skeleton className="h-3 w-64" />
          </div>
        </div>
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-5/6" />
        <Skeleton className="h-12 w-48 rounded-full" />
      </div>
    </div>
  );
}
