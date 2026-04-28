/**
 * Phase 13.10 — forwarder to Express `GET /admin/stats`.
 * Composite KPI dashboard payload (users / stores / products /
 * reviews / orders / gmv / pendingOrders / recentTransactions /
 * 14-day daily revenue).
 */
import { type NextRequest } from "next/server";
import { forwardToApi } from "@/lib/server/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return forwardToApi(req, `/admin/stats`);
}
