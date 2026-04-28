/**
 * Phase 13.6 — forwarder to Express:
 *   PATCH  /questions/:id — admin/asker edits (admin-only for answer field)
 *   DELETE /questions/:id — admin/asker deletes (admin → audit row)
 */
import { type NextRequest } from "next/server";
import { forwardToApi } from "@/lib/server/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return forwardToApi(req, `/questions/${params.id}`);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  return forwardToApi(req, `/questions/${params.id}`);
}
