/**
 * Phase 13.6 — forwarder to Express:
 *   GET  /products/:productId/questions — public list
 *   POST /products/:productId/questions — buyer asks (auth-gated server-side)
 */
import { type NextRequest } from "next/server";
import { forwardToApi } from "@/lib/server/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  return forwardToApi(req, `/products/${params.id}/questions`);
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return forwardToApi(req, `/products/${params.id}/questions`);
}
