/**
 * Phase 13.11 — forwarder to Express `GET /business-types`.
 * Public reference data for the become-seller form dropdown.
 */
import { type NextRequest } from "next/server";
import { forwardToApi } from "@/lib/server/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return forwardToApi(req, `/business-types`);
}
