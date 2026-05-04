/**
 * forwarder to Express `GET /products/:id`.
 * Public product detail — Express handles the soft-deleted /
 * orphan-store 404 + avgRating + reviewCount derivation.
 */
import { type NextRequest } from "next/server";
import { forwardToApi } from "@/lib/server/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  return forwardToApi(req, `/products/${params.id}`);
}
