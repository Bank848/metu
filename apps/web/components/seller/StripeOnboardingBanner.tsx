"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { CreditCard } from "lucide-react";

/**
 * Phase 44 — the "Connect Stripe to start accepting payments" CTA
 * lived in the seller layout and rendered on every /seller/* page,
 * including /seller/onboarding itself. Clicking the banner button
 * while already on the destination did nothing, so users tapped it
 * repeatedly with no feedback.
 *
 * Phase 47 — the banner used to read its visibility from a server-
 * side `needsStripe` prop. App Router caches layouts across sibling
 * navigation, so `needsStripe` stayed at the value captured on the
 * first render and a seller who finished Stripe-Connect onboarding
 * still saw "Set up Stripe →" on the dashboard until they hard-
 * refreshed. The banner now self-fetches `/api/seller/stripe/status`
 * on mount and on every pathname change, so it disappears the moment
 * the account.updated webhook flips chargesEnabled in the DB.
 */
export function StripeOnboardingBanner() {
  const pathname = usePathname() ?? "";
  const [needsStripe, setNeedsStripe] = useState<boolean>(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/seller/stripe/status", { cache: "no-store", credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive || !d) return;
        // The endpoint returns `{ configured, stripeAccountId, chargesEnabled, ... }`
        // when Stripe is set up. We only need the latter two to decide.
        const need = !d.stripeAccountId || !d.chargesEnabled;
        setNeedsStripe(need);
      })
      .catch(() => {
        // Silent fail — keeps the banner hidden if the status endpoint
        // is down. The seller can still reach /seller/onboarding via
        // the sidebar even without the banner CTA.
      });
    return () => {
      alive = false;
    };
  }, [pathname]);

  // Hide on the destination page so re-clicking the CTA isn't a no-op.
  if (pathname.startsWith("/seller/onboarding")) return null;
  if (!needsStripe) return null;

  return (
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
  );
}
