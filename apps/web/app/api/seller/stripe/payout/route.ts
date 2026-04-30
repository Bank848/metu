/**
 * Phase 33B — BFF forwarder for the manual-payout endpoint. Single
 * POST to the Express server which orchestrates the Stripe API call.
 */
import { type NextRequest } from "next/server";
import { forwardToApi } from "@/lib/server/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  return forwardToApi(req, "/seller/stripe/payout");
}
