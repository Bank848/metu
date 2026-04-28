/**
 * Phase 13.7 — forwarders to Express:
 *   POST   /favorites/:productId   — heart
 *   DELETE /favorites/:productId   — un-heart
 */
import { type NextRequest } from "next/server";
import { forwardToApi } from "@/lib/server/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { productId: string } }) {
  return forwardToApi(req, `/favorites/${params.productId}`);
}

export async function DELETE(req: NextRequest, { params }: { params: { productId: string } }) {
  return forwardToApi(req, `/favorites/${params.productId}`);
}
