/**
 * Phase 13.6 — forwarder to Express `PATCH /questions/:id/answer`.
 * Only the product's seller (or admin) may answer; ownership check
 * lives in services/qna.service.ts.
 */
import { type NextRequest } from "next/server";
import { forwardToApi } from "@/lib/server/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return forwardToApi(req, `/questions/${params.id}/answer`);
}
