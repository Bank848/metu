import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Stripe sends sellers here when their onboarding link
 * expires (e.g. they bookmarked it, came back next day). Bounce them
 * straight back to the onboarding entry so a fresh link can be cut.
 */
export default function OnboardingRefreshPage() {
  redirect("/seller/onboarding");
}
