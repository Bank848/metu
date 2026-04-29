/**
 * Phase 17.1 — admin settings forwarder.
 *   PATCH /admin/settings — body { walletEnabled?, chatEnabled?, promptpayId? }
 * Auth + admin role enforced server-side.
 */
import { type NextRequest } from "next/server";
import { forwardToApi } from "@/lib/server/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest) {
  return forwardToApi(req, "/admin/settings");
}
