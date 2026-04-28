/**
 * Phase 13.2 — thin forwarder to Express `POST /auth/login`. See
 * `lib/server/proxy.ts` for why we proxy instead of letting the
 * browser call Express directly (cookie-domain story).
 */
import { type NextRequest } from "next/server";
import { forwardToApi } from "@/lib/server/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  return forwardToApi(req, "/auth/login");
}
