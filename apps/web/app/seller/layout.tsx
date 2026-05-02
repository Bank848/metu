import { redirect } from "next/navigation";
import { PauseCircle } from "lucide-react";
import { SellerSidebar } from "@/components/SellerSidebar";
import { StripeOnboardingBanner } from "@/components/seller/StripeOnboardingBanner";
import { getMe, requireResetGuard } from "@/lib/session";

// Phase 47 — force the layout to re-render every navigation so the
// Stripe-onboarding banner picks up the latest stripeChargesEnabled
// flag the moment the account.updated webhook flips it. Without
// this, the layout stayed mounted with stale needsStripe=true even
// after the seller finished Stripe-Connect onboarding.
export const dynamic = "force-dynamic";

export default async function SellerLayout({ children }: { children: React.ReactNode }) {
  const me = await getMe();
  if (!me) redirect("/login?next=/seller");
  if (!me.user?.store && me.role !== "admin") redirect("/become-seller");
  // Phase 15.5 — sellers can't manage their store while a force-
  // reset is pending. Bounce to /profile/edit until cleared.
  requireResetGuard(me, "/seller");

  // Phase 16.1 — store suspended? Seller can still see + edit
  // everything, but a persistent banner explains why public surfaces
  // hide their store. Cleared the moment admin un-suspends.
  const suspendedAt = (me.user?.store as any)?.suspendedAt as Date | string | null | undefined;
  const isSuspended = Boolean(suspendedAt);

  // Phase 47 — Stripe-onboarding banner now self-fetches its
  // visibility on mount + on every pathname change, so we don't
  // pre-compute `needsStripe` here. The previous server-side calc
  // got captured in App Router's layout cache and a seller who
  // finished onboarding still saw the banner until they hard-
  // refreshed. See StripeOnboardingBanner.

  return (
    <div className="flex min-h-screen bg-space-black">
      <SellerSidebar storeName={me.user?.store?.name} />
      <main id="main" className="flex-1 px-8 py-10">
        {isSuspended && (
          <div className="mb-6 rounded-xl border border-amber-400/30 bg-amber-400/10 p-4 flex items-start gap-3">
            <PauseCircle className="h-5 w-5 text-amber-400 mt-0.5 shrink-0" />
            <div className="text-sm">
              <div className="font-semibold text-amber-100 mb-0.5">
                Your store is suspended
              </div>
              <div className="text-amber-100/80">
                Buyers cannot see your store on /browse, /store/{me.user!.store!.storeId},
                or via product links — those surfaces all return 404. You can
                still edit products, run analytics, and reply to questions.
                Reach out to an admin to lift the suspension.
              </div>
            </div>
          </div>
        )}
        <StripeOnboardingBanner />
        {children}
      </main>
    </div>
  );
}
