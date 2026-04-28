/**
 * Phase 13.5 — forwarder to Express `POST /products/:productId/reviews`.
 * Soft-delete / orphan check + creation now live server-side.
 */
import { type NextRequest } from "next/server";
import { forwardToApi } from "@/lib/server/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return forwardToApi(req, `/products/${params.id}/reviews`);
}
