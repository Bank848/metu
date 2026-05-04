/**
 * forwarder to Express
 * `DELETE /auth/sessions/all-others` — "Sign out everywhere".
 * Revokes every better-auth session for the user EXCEPT the
 * current one.
 */
import { type NextRequest } from "next/server";
import { forwardToApi } from "@/lib/server/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(req: NextRequest) {
  return forwardToApi(req, "/auth/sessions/all-others");
}
