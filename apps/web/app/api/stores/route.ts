/**
 * forwarder to Express `GET /stores`.
 * Public store list (live stores only). Preserves the `?limit=N`
 * query param.
 */
import { type NextRequest } from "next/server";
import { forwardToApi } from "@/lib/server/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const search = req.nextUrl.search || "";
  return forwardToApi(req, `/stores${search}`);
}
