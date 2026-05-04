/**
 * forwarder to Express `POST /auth/totp/step-up`.
 * Body: `{code: string}` — 6-digit authenticator code.
 * Server stamps Session.lastTotpAt so the next requireRecent2FA()
 * gate lets the action through.
 */
import { type NextRequest } from "next/server";
import { forwardToApi } from "@/lib/server/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  return forwardToApi(req, "/auth/totp/step-up");
}
