/**
 * BFF forwarder for the Stripe-backed seller wallet.
 * Returns { configured, onboarded, balance, payouts, charges } —
 * everything fetched live from Stripe, nothing materialised in our DB.
 */
import { type NextRequest } from "next/server";
import { forwardToApi } from "@/lib/server/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return forwardToApi(req, "/seller/wallet");
}
