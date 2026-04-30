import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Phase 27 — Stripe redirects sellers here after they finish (or
 * abandon) the hosted onboarding flow. Hit /api/seller/stripe/status
 * server-side to refresh capability flags, then bounce to the seller
 * dashboard. Stripe doesn't tell us whether onboarding completed in
 * the URL (the dashboard webhook does) so we just refresh + redirect.
 */
export default async function OnboardingReturnPage() {
  // The /api/seller/stripe/status route requires auth ; calling it here
  // forwards cookies via the BFF proxy so it works without extra glue.
  // But during SSR we can't rely on /api/* — call the server directly.
  const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:4000";
  try {
    await fetch(`${apiBase}/seller/stripe/status`, { cache: "no-store" });
  } catch {
    // Ignore — the seller dashboard will surface any error.
  }
  redirect("/seller/onboarding");
}
