/**
 * Phase 16.2 — forwarder to Express `POST /auth/totp/enroll-verify`.
 * Confirms the secret with the first 6-digit code; flips
 * totpEnabled=true on success.
 */
import { type NextRequest } from "next/server";
import { forwardToApi } from "@/lib/server/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  return forwardToApi(req, "/auth/totp/enroll-verify");
}
