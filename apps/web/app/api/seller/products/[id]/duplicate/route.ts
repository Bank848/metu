/**
 * Phase 13.9.2 — forwarder to Express `POST /seller/products/:id/duplicate`.
 * Clones the product (variants + images + tags), creates the copy
 * paused (isActive=false), skips reviews + sales history.
 */
import { type NextRequest } from "next/server";
import { forwardToApi } from "@/lib/server/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return forwardToApi(req, `/seller/products/${params.id}/duplicate`);
}
