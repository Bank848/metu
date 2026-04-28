/**
 * Phase 13.9.1 — forwarder to Express `GET /seller/stats`.
 * Read-only analytics dashboard payload.
 */
import { type NextRequest } from "next/server";
import { forwardToApi } from "@/lib/server/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return forwardToApi(req, `/seller/stats`);
}
