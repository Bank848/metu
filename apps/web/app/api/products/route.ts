/**
 * forwarder to Express `GET /products` (browse).
 * Preserves the inbound query string so every filter (category,
 * tags, minPrice, maxPrice, delivery, q, sort, page, pageSize)
 * survives the BFF hop.
 * The full browse logic + DTO shaping lives in
 * apps/server/src/services/products.service.ts (Phase 13.1) so this
 * file is a pure proxy.
 */
import { type NextRequest } from "next/server";
import { forwardToApi } from "@/lib/server/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const search = req.nextUrl.search || "";
  return forwardToApi(req, `/products${search}`);
}
