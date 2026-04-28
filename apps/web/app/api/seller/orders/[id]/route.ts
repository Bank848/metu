/**
 * Phase 13.9.2 — forwarder to Express `PATCH /seller/orders/:id`.
 * Status flip: fulfilled / cancelled. Express enforces the
 * guardrails (AlreadyRefunded 409, InvalidTransition 409, Forbidden
 * 403 if no line from this store).
 */
import { type NextRequest } from "next/server";
import { forwardToApi } from "@/lib/server/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return forwardToApi(req, `/seller/orders/${params.id}`);
}
