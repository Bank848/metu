/**
 * Phase 14.4 — forwarder to Express `PATCH /auth/phone`.
 * Sets/updates the user's phone, clears phoneVerifiedAt.
 */
import { type NextRequest } from "next/server";
import { forwardToApi } from "@/lib/server/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest) {
  return forwardToApi(req, "/auth/phone");
}
