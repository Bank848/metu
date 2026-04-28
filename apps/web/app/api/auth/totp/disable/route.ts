/**
 * Phase 16.2 — forwarder to Express `POST /auth/totp/disable`.
 * Wipes secret + flips totpEnabled=false. Requires the user's
 * current password in the body (defence in depth).
 */
import { type NextRequest } from "next/server";
import { forwardToApi } from "@/lib/server/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  return forwardToApi(req, "/auth/totp/disable");
}
