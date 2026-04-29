/**
 * Phase 17.1 — wallet balance forwarder.
 *   GET /wallet — { balance, walletEnabled }
 */
import { type NextRequest } from "next/server";
import { forwardToApi } from "@/lib/server/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return forwardToApi(req, "/wallet");
}
