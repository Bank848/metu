/**
 * Phase 27 — BFF forwarder for Stripe Connect status refresh.
 * Returns { stripeAccountId, payoutsEnabled, chargesEnabled }.
 */
import { type NextRequest } from "next/server";
import { forwardToApi } from "@/lib/server/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return forwardToApi(req, "/seller/stripe/status");
}
