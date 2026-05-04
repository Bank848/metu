/**
 * forwarder to Express `GET /auth/sessions`.
 * Lists active better-auth sessions for the current user + the id
 * of the "current" session (so the UI can disable its Revoke button).
 */
import { type NextRequest } from "next/server";
import { forwardToApi } from "@/lib/server/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return forwardToApi(req, "/auth/sessions");
}
