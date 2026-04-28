/**
 * Phase 13.3 — forwarder to Express `PATCH /cart/items/:id` and
 * `DELETE /cart/items/:id`. Ownership check (404 when the item
 * belongs to a different user) is enforced server-side in
 * cart.service.
 */
import { type NextRequest } from "next/server";
import { forwardToApi } from "@/lib/server/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return forwardToApi(req, `/cart/items/${params.id}`);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  return forwardToApi(req, `/cart/items/${params.id}`);
}
