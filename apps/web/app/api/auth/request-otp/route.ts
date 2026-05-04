/**
 * forwarder to Express `POST /auth/request-otp`.
 * Sends a 6-digit code to the user's phone via the configured
 * transport (console in dev, Twilio when env set).
 */
import { type NextRequest } from "next/server";
import { forwardToApi } from "@/lib/server/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  return forwardToApi(req, "/auth/request-otp");
}
