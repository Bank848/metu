/**
 * Phase 48 — POST forwarder for the "Ban this user's IPs" quick
 * action. Pulls every distinct IP from the user's Session rows and
 * inserts a banned_ip row for each.
 */
import { type NextRequest } from "next/server";
import { forwardToApi } from "@/lib/server/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return forwardToApi(req, `/admin/users/${params.id}/ban-ips`);
}
