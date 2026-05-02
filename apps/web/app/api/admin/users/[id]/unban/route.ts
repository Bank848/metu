/**
 * Phase 48 — POST /api/admin/users/:id/unban → Express
 * `/admin/users/:id/unban`. Clears bannedAt + bannedReason +
 * deletedAt so the user can sign in again.
 */
import { type NextRequest } from "next/server";
import { forwardToApi } from "@/lib/server/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return forwardToApi(req, `/admin/users/${params.id}/unban`);
}
