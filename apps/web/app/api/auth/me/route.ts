/**
 * forwarder to Express `GET /auth/me` and
 * `PATCH /auth/me`. Profanity + email-uniqueness guards now run
 * server-side.
 */
import { type NextRequest } from "next/server";
import { forwardToApi } from "@/lib/server/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return forwardToApi(req, "/auth/me");
}

export async function PATCH(req: NextRequest) {
  return forwardToApi(req, "/auth/me");
}

// GDPR self-delete. Body must carry `confirmation` matching
// the user's username; API verifies + applies the hybrid delete.
export async function DELETE(req: NextRequest) {
  return forwardToApi(req, "/auth/me");
}
