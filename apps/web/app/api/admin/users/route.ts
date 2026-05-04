/**
 * forwarder to Express `GET /admin/users`.
 * Preserves the inbound query string (q, role, page, pageSize).
 */
import { type NextRequest } from "next/server";
import { forwardToApi } from "@/lib/server/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const search = req.nextUrl.search || "";
  return forwardToApi(req, `/admin/users${search}`);
}
