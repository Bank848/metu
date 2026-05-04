/**
 * forwarders to Express:
 *   PATCH  /admin/users/:id   role change (self-demote 400)
 *   DELETE /admin/users/:id   soft-delete (with optional reason → ban)
 */
import { type NextRequest } from "next/server";
import { forwardToApi } from "@/lib/server/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return forwardToApi(req, `/admin/users/${params.id}`);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  return forwardToApi(req, `/admin/users/${params.id}`);
}
