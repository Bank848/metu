"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CreditCard } from "lucide-react";

/**
 * Phase 44 — the "Connect Stripe to start accepting payments" CTA
 * lived in the seller layout and rendered on every /seller/* page,
 * including /seller/onboarding itself. Clicking the banner button
 * while already on the destination did nothing, so users tapped it
 * repeatedly with no feedback.
 *
 * This client wrapper hides the banner on /seller/onboarding and any
 * of its sub-routes — the page already shows the same status + a
 * dedicated "Continue onboarding" button.
 */
export function StripeOnboardingBanner() {
  const pathname = usePathname() ?? "";
  if (pathname.startsWith("/seller/onboarding")) return null;
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
