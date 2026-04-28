/**
 * Phase 14.4 — forwarder to Express `POST /auth/verify-otp`.
 * Consumes the pending 6-digit code, sets phoneVerifiedAt.
 */
import { type NextRequest } from "next/server";
import { forwardToApi } from "@/lib/server/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  return forwardToApi(req, "/auth/verify-otp");
}
