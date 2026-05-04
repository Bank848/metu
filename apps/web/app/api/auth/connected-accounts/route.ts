/**
 * forwarder to Express `GET /auth/connected-accounts`.
 * Lists the user's linked social provider rows (Google etc.) plus
 * a `googleEnabled` flag so the UI can render "Link Google" vs
 * "not configured".
 */
import { type NextRequest } from "next/server";
import { forwardToApi } from "@/lib/server/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return forwardToApi(req, "/auth/connected-accounts");
}
