/**
 * forwarder to Express `GET /seller/orders?status=...`.
 * Preserves the inbound query string so the status filter still works.
 */
import { type NextRequest } from "next/server";
import { forwardToApi } from "@/lib/server/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const search = req.nextUrl.search || "";
  return forwardToApi(req, `/seller/orders${search}`);
}
