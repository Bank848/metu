/**
 * Phase 13.9.2 — forwarder to Express `PATCH /seller/product-items/:id`.
 * Targeted variant nudge (price / discountPercent / quantity) used
 * by the bulk-edit page.
 */
import { type NextRequest } from "next/server";
import { forwardToApi } from "@/lib/server/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return forwardToApi(req, `/seller/product-items/${params.id}`);
}
