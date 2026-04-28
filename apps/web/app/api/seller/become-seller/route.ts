/**
 * Phase 13.9.2 — forwarder to Express `POST /seller/become-seller`.
 * Auth-only (no requireStore — that's the point).
 */
import { type NextRequest } from "next/server";
import { forwardToApi } from "@/lib/server/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  return forwardToApi(req, `/seller/become-seller`);
}
