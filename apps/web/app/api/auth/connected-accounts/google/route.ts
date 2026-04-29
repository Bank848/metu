/**
 * Phase 18 — forwarder to Express `DELETE /auth/connected-accounts/google`.
 * Unlinks the user's Google account. Server enforces the lockout
 * guard (refuses if the user has no password set).
 */
import { type NextRequest } from "next/server";
import { forwardToApi } from "@/lib/server/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(req: NextRequest) {
  return forwardToApi(req, "/auth/connected-accounts/google");
}
