/**
 * forwarder to Express
 * `POST /admin/users/:id/require-password-reset`.
 * Body: { value: boolean }. Forces or clears the User's
 * requirePasswordReset flag.
 */
import { type NextRequest } from "next/server";
import { forwardToApi } from "@/lib/server/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return forwardToApi(req, `/admin/users/${params.id}/require-password-reset`);
}
