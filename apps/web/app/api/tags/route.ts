/**
 * Phase 13.11 — forwarder to Express `GET /tags`.
 * Public reference data driving tag chips on /browse.
 */
import { type NextRequest } from "next/server";
import { forwardToApi } from "@/lib/server/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return forwardToApi(req, `/tags`);
}
