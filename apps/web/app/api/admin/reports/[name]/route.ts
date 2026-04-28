/**
 * Phase 13.10 — forwarder to Express `GET /admin/reports/:name`.
 * Five named raw-SQL reports: revenue-by-category, top-stores,
 * orders-by-status, signups-per-day, coupon-usage. Express returns
 * 404 UnknownReport for any other name.
 */
import { type NextRequest } from "next/server";
import { forwardToApi } from "@/lib/server/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { name: string } }) {
  return forwardToApi(req, `/admin/reports/${params.name}`);
}
