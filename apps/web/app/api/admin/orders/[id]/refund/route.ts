/**
 * Phase 27 — BFF forwarder for admin refund. Forwards body + cookies
 * to Express POST /admin/orders/:id/refund.
 */
import { type NextRequest } from "next/server";
import { forwardToApi } from "@/lib/server/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return forwardToApi(req, `/admin/orders/${params.id}/refund`);
}
