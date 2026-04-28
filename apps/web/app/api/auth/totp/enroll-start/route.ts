/**
 * Phase 16.2 — forwarder to Express `POST /auth/totp/enroll-start`.
 * Returns { secret, otpauthUri } for QR rendering.
 */
import { type NextRequest } from "next/server";
import { forwardToApi } from "@/lib/server/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  return forwardToApi(req, "/auth/totp/enroll-start");
}
