/**
 * Phase 13.3 — forwarder to Express `GET /cart`. Cart logic now
 * lives in apps/server/src/services/cart.service.ts. The proxy
 * carries the session cookie through; Express verifies via
 * requireAuth().
 */
import { type NextRequest } from "next/server";
import { forwardToApi } from "@/lib/server/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return forwardToApi(req, "/cart");
}
