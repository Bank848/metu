/**
 * Phase 13.8 — forwarder to Express `GET /messages/unread`.
 * Cheap COUNT for the TopNav unread dot.
 */
import { type NextRequest } from "next/server";
import { forwardToApi } from "@/lib/server/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return forwardToApi(req, `/messages/unread`);
}
