/**
 * Phase 13.5 — forwarder to Express `PATCH /reviews/:id` and
 * `DELETE /reviews/:id`. Admin-OR-author gate + audit-log write
 * (when admin reaches into someone else's review) now live in
 * apps/server/src/services/reviews.service.ts.
 */
import { type NextRequest } from "next/server";
import { forwardToApi } from "@/lib/server/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return forwardToApi(req, `/reviews/${params.id}`);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  return forwardToApi(req, `/reviews/${params.id}`);
}
