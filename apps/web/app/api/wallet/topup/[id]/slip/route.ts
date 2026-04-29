/**
 * Phase 17.3 — submit payment slip for a pending top-up.
 *   POST /wallet/topup/:id/slip   body: { slipImage: dataUrl }
 */
import { type NextRequest } from "next/server";
import { forwardToApi } from "@/lib/server/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  return forwardToApi(req, `/wallet/topup/${params.id}/slip`);
}
