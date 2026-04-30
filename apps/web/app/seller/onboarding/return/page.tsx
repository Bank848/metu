import { redirect } from "next/navigation";
import { apiFetch } from "@/lib/server/api";

export const dynamic = "force-dynamic";

/**
 * Phase 27 — Stripe redirects sellers here after they finish (or
 * abandon) the hosted onboarding flow. We hit /seller/stripe/status
 * via apiFetch (which forwards the seller's session cookie) so the
 * server-side capability-flag sync runs ; then bounce to /seller/
 * onboarding which will show the freshly-synced status.
 */
export default async function OnboardingReturnPage() {
  try {
    await apiFetch("/seller/stripe/status");
  } catch {
    // Ignore — the seller dashboard will surface any error itself.
  }
  redirect("/seller/onboarding");
}
