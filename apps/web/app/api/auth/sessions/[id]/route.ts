/**
 * Phase 15.2 — forwarder to Express `DELETE /auth/sessions/:id`.
 * Revokes one better-auth session row (ownership-checked server-
 * side via the userId predicate).
 */
import { type NextRequest } from "next/server";
import { forwardToApi } from "@/lib/server/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  return forwardToApi(req, `/auth/sessions/${params.id}`);
}
