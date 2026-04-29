/**
 * Phase 17.3 — start a top-up; receive QR payload.
 *   POST /wallet/topup    body: { amountBaht: number }
 */
import { type NextRequest } from "next/server";
import { forwardToApi } from "@/lib/server/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  return forwardToApi(req, "/wallet/topup");
}
