/**
 * Phase 17.3 — admin top-up review queue.
 *   GET /admin/topups?status=pending|all
 */
import { type NextRequest } from "next/server";
import { forwardToApi } from "@/lib/server/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const search = new URL(req.url).search;
  return forwardToApi(req, `/admin/topups${search}`);
}
