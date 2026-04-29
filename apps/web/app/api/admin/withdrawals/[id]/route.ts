/**
 * Phase 20.2 — forwarder to Express `GET /admin/withdrawals/:id`.
 * Returns the full withdrawal row (with bank info + slip if approved).
 */
import { type NextRequest } from "next/server";
import { forwardToApi } from "@/lib/server/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  return forwardToApi(req, `/admin/withdrawals/${params.id}`);
}
