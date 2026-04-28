/**
 * Phase 13.10 — forwarder to Express `DELETE /admin/stores/:id`.
 * Soft-delete + audit row.
 */
import { type NextRequest } from "next/server";
import { forwardToApi } from "@/lib/server/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  return forwardToApi(req, `/admin/stores/${params.id}`);
}
