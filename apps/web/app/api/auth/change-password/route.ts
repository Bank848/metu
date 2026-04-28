/**
 * Phase 13.2 — forwarder to Express `POST /auth/change-password`.
 * Server-side handler verifies current password + hashes the new
 * one with the same bcrypt 10-round cost as the legacy BFF route.
 */
import { type NextRequest } from "next/server";
import { forwardToApi } from "@/lib/server/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  return forwardToApi(req, "/auth/change-password");
}
