/**
 * Phase 20.2 — forwarder to Express `GET /seller/wallet`.
 * Returns the calling seller's store balance + recent activity +
 * pending withdrawal rows.
 */
import { type NextRequest } from "next/server";
import { forwardToApi } from "@/lib/server/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return forwardToApi(req, "/seller/wallet");
}
