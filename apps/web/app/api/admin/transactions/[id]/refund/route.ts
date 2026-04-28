/**
 * Phase 13.10 — forwarder to Express `POST /admin/transactions/:id/refund`.
 * Marks all linked orders refunded + inserts a matching refund Transaction.
 */
import { type NextRequest } from "next/server";
import { forwardToApi } from "@/lib/server/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return forwardToApi(req, `/admin/transactions/${params.id}/refund`);
}
