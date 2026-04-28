/**
 * Phase 13.2 — forwarder to Express `POST /auth/logout`. Express
 * sends a Set-Cookie header that clears the cookie; the proxy
 * mirrors it back to the browser.
 */
import { type NextRequest } from "next/server";
import { forwardToApi } from "@/lib/server/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  return forwardToApi(req, "/auth/logout");
}
