/**
 * Phase 27 — BFF forwarder for Stripe onboarding link creation.
 * Returns { url } that the client redirects to.
 */
import { type NextRequest } from "next/server";
import { forwardToApi } from "@/lib/server/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  return forwardToApi(req, "/seller/stripe/onboard");
}
