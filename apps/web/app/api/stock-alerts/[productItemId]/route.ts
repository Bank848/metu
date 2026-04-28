/**
 * Phase 13.7 — forwarders to Express:
 *   POST   /stock-alerts/:productItemId   — subscribe (auth, idempotent)
 *   DELETE /stock-alerts/:productItemId   — unsubscribe
 */
import { type NextRequest } from "next/server";
import { forwardToApi } from "@/lib/server/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { productItemId: string } },
) {
  return forwardToApi(req, `/stock-alerts/${params.productItemId}`);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { productItemId: string } },
) {
  return forwardToApi(req, `/stock-alerts/${params.productItemId}`);
}
