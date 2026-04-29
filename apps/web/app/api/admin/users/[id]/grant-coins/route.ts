/**
 * Phase 17.1 — admin grant coins forwarder.
 *   POST /admin/users/:id/grant-coins
 *     body: { amount: number, reason: string }
 */
import { type NextRequest } from "next/server";
import { forwardToApi } from "@/lib/server/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  return forwardToApi(req, `/admin/users/${params.id}/grant-coins`);
}
