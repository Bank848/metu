/**
 * Phase 13.9.2 — forwarder to Express `POST /seller/orders/:id/refund`.
 * Marks order refunded + creates a refund Transaction in one atomic
 * write. Sellers can only refund orders containing one of their
 * lines AND currently paid/fulfilled.
 */
import { type NextRequest } from "next/server";
import { forwardToApi } from "@/lib/server/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return forwardToApi(req, `/seller/orders/${params.id}/refund`);
}
