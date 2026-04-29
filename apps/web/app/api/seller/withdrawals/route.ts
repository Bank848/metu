/**
 * Phase 20.2 — forwarders to Express `/seller/withdrawals`.
 *   GET  → list this seller's withdrawal history (newest first)
 *   POST → submit a new withdrawal request
 */
import { type NextRequest } from "next/server";
import { forwardToApi } from "@/lib/server/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return forwardToApi(req, "/seller/withdrawals");
}

export async function POST(req: NextRequest) {
  return forwardToApi(req, "/seller/withdrawals");
}
