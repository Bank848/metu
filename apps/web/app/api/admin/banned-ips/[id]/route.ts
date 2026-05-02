/**
 * Phase 48 — DELETE forwarder for /admin/banned-ips/:id. Removes
 * the row + invalidates the middleware's in-memory cache for that IP.
 */
import { type NextRequest } from "next/server";
import { forwardToApi } from "@/lib/server/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  return forwardToApi(req, `/admin/banned-ips/${params.id}`);
}
