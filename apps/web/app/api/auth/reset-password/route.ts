/**
 * Phase 13.2.1 — forwarder to Express `POST /auth/reset-password`.
 * Token verification + bcrypt + audit log live server-side.
 */
import { type NextRequest } from "next/server";
import { forwardToApi } from "@/lib/server/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  return forwardToApi(req, "/auth/reset-password");
}
