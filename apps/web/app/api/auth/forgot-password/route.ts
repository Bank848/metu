/**
 * Phase 13.2.1 — forwarder to Express `POST /auth/forgot-password`.
 * Token generation + email send live server-side; the proxy is just
 * a passthrough.
 */
import { type NextRequest } from "next/server";
import { forwardToApi } from "@/lib/server/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  return forwardToApi(req, "/auth/forgot-password");
}
