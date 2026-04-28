/**
 * Phase 13.11 — forwarder to Express `GET /categories`.
 * Public reference data driving filter chips on /browse and the
 * category select on the new-product form.
 */
import { type NextRequest } from "next/server";
import { forwardToApi } from "@/lib/server/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return forwardToApi(req, `/categories`);
}
