/**
 * Phase 13.8 — forwarder to Express:
 *   GET  /messages           inbox (no query) OR thread (?with=N)
 *   POST /messages           send a message (self-send rejected upstream)
 *
 * The inbound query string is preserved by forwardToApi via the
 * full request URL; we just hand the path here.
 */
import { type NextRequest } from "next/server";
import { forwardToApi } from "@/lib/server/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // Preserve ?with=N etc. — forwardToApi appends the request's
  // search params via NextRequest.nextUrl.search if we include it.
  const search = req.nextUrl.search || "";
  return forwardToApi(req, `/messages${search}`);
}

export async function POST(req: NextRequest) {
  return forwardToApi(req, `/messages`);
}
