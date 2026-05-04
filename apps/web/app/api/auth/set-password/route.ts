/**
 * forwarder to Express `POST /auth/set-password`.
 * First-time password set for OAuth-only users (User.password is
 * NULL because they signed up via Google). Server-side handler
 * refuses with 400 PasswordAlreadySet when there's already a
 * password — those calls go through change-password instead.
 */
import { type NextRequest } from "next/server";
import { forwardToApi } from "@/lib/server/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  return forwardToApi(req, "/auth/set-password");
}
