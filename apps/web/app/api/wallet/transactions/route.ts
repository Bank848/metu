/**
 * Phase 17.1 — wallet transaction list forwarder.
 *   GET /wallet/transactions — recent ledger
 */
import { type NextRequest } from "next/server";
import { forwardToApi } from "@/lib/server/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // Forward query params (?limit=N) verbatim through req.url's search.
  const search = new URL(req.url).search;
  return forwardToApi(req, `/wallet/transactions${search}`);
}
