/**
 * Phase 20.2 — forwarder to Express `GET /admin/withdrawals`.
 *   ?status=pending  (default) — active queue
 *   ?status=all                 — full history newest-first
 */
import { type NextRequest } from "next/server";
import { forwardToApi } from "@/lib/server/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const search = new URL(req.url).search;
  return forwardToApi(req, `/admin/withdrawals${search}`);
}
