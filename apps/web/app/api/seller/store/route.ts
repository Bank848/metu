/**
 * Phase 13.9 — full forwarders to Express:
 *   GET   /seller/store   (read, Phase 13.9.1)
 *   PATCH /seller/store   (write, Phase 13.9.2)
 */
import { type NextRequest } from "next/server";
import { forwardToApi } from "@/lib/server/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return forwardToApi(req, `/seller/store`);
}

export async function PATCH(req: NextRequest) {
  return forwardToApi(req, `/seller/store`);
}
