/**
 * Phase 20.2 — forwarder to Express
 * `POST /admin/withdrawals/:id/reject`. Body: { reason: string }
 */
import { type NextRequest } from "next/server";
import { forwardToApi } from "@/lib/server/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return forwardToApi(req, `/admin/withdrawals/${params.id}/reject`);
}
