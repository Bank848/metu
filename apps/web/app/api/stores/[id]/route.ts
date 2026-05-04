/**
 * forwarder to Express `GET /stores/:id`.
 * Public storefront — Express handles the soft-deleted 404 + filters
 * soft-deleted products from the embedded list.
 */
import { type NextRequest } from "next/server";
import { forwardToApi } from "@/lib/server/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  return forwardToApi(req, `/stores/${params.id}`);
}
