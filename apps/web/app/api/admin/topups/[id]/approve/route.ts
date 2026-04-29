/**
 * Phase 17.3 — admin manual approve top-up.
 *   POST /admin/topups/:id/approve
 */
import { type NextRequest } from "next/server";
import { forwardToApi } from "@/lib/server/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  return forwardToApi(req, `/admin/topups/${params.id}/approve`);
}
