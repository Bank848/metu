/**
 * full forwarders to Express:
 *   GET  /seller/coupons   list (with usage count)
 *   POST /seller/coupons   create
 * The GET endpoint was missed in Phase 13.9.1 (it lives in the same
 * file as POST); both ship together here.
 */
import { type NextRequest } from "next/server";
import { forwardToApi } from "@/lib/server/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return forwardToApi(req, `/seller/coupons`);
}

export async function POST(req: NextRequest) {
  return forwardToApi(req, `/seller/coupons`);
}
