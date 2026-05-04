/**
 * forwarder to Express
 * `POST /admin/stores/:id/suspend`. Body: { value: boolean }.
 * Toggles store.suspendedAt (set to NOW or cleared to NULL).
 */
import { type NextRequest } from "next/server";
import { forwardToApi } from "@/lib/server/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return forwardToApi(req, `/admin/stores/${params.id}/suspend`);
}
