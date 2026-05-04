/**
 * GET / POST forwarder for /admin/banned-ips. Admin role
 * gate is enforced API-side.
 */
import { type NextRequest } from "next/server";
import { forwardToApi } from "@/lib/server/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return forwardToApi(req, "/admin/banned-ips");
}

export async function POST(req: NextRequest) {
  return forwardToApi(req, "/admin/banned-ips");
}
