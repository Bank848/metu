/**
 * Phase 13.9.1 — forwarder to Express `GET /seller/orders/export`.
 * Express sets Content-Type: text/csv + Content-Disposition; the
 * proxy preserves both via forwardToApi's header passthrough.
 */
import { type NextRequest } from "next/server";
import { forwardToApi } from "@/lib/server/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return forwardToApi(req, `/seller/orders/export`);
}
