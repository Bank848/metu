import Link from "next/link";
import { redirect } from "next/navigation";
import { PauseCircle, CreditCard } from "lucide-react";
import { SellerSidebar } from "@/components/SellerSidebar";
import { getMe, requireResetGuard } from "@/lib/session";

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

  // Phase 27 — Stripe Connect onboarding nudge. Until the store has a
  // Stripe account ID + charges enabled, buyers' "Buy now" hits a 503
  // because the API can't open a PaymentIntent on a missing account.
  // The banner is dismissible-by-fixing — it disappears the moment
  // account.updated webhook flips chargesEnabled on the Store row.
  const store = me.user?.store as
    | { stripeAccountId?: string | null; stripeChargesEnabled?: boolean | null }
    | undefined;
  const needsStripe = Boolean(me.user?.store) && (
    !store?.stripeAccountId || !store?.stripeChargesEnabled
  );

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
        {needsStripe && (
          <div className="mb-6 rounded-xl border border-mint/30 bg-mint/5 p-4 flex items-start gap-3">
            <CreditCard className="h-5 w-5 text-mint mt-0.5 shrink-0" />
            <div className="text-sm flex-1">
              <div className="font-semibold text-mint mb-0.5">
                Connect Stripe to start accepting payments
              </div>
              <div className="text-ink-secondary">
                Buyers can&apos;t complete checkout until your store is linked to a
                Stripe account. The onboarding flow runs in test mode — sample
                data is auto-filled, takes ~2 minutes.
              </div>
            </div>
            <Link
              href="/seller/onboarding"
              className="self-center rounded-lg bg-mint text-space-950 px-4 py-2 text-sm font-semibold hover:bg-mint/90 whitespace-nowrap"
            >
              Set up Stripe →
            </Link>
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
