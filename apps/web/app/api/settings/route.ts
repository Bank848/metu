/**
 * public settings forwarder.
 *   GET /settings — returns { settings: { walletEnabled, chatEnabled, promptpayId, updatedAt } }
 * Used by the BFF `getSettings()` server helper to gate UI surfaces
 * (wallet pill, chat icon, message CTAs).
 */
import { type NextRequest } from "next/server";
import { forwardToApi } from "@/lib/server/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return forwardToApi(req, "/settings");
}
