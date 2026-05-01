/**
 * Phase 46 — forwards POST to Express /auth/verify-phone-firebase.
 * The client posts the Firebase ID token here after a successful SMS
 * confirmation; the API verifies it and stamps phoneVerifiedAt.
 */
import { type NextRequest } from "next/server";
import { forwardToApi } from "@/lib/server/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  return forwardToApi(req, "/auth/verify-phone-firebase");
}
