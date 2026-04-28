/**
 * Phase 13.3 — forwarder to Express `POST /cart/items`. Merge-on-
 * duplicate logic lives server-side; this proxy is just a passthrough
 * for the body + session cookie.
 */
import { type NextRequest } from "next/server";
import { forwardToApi } from "@/lib/server/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  return forwardToApi(req, "/cart/items");
}
