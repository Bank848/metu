/**
 * full forwarders to Express:
 *   GET    /seller/products/:id   (read, Phase 13.9.1)
 *   PATCH  /seller/products/:id   (write — fast-path { isActive } OR full edit)
 *   DELETE /seller/products/:id   (write — soft-delete + audit)
 */
import { type NextRequest } from "next/server";
import { forwardToApi } from "@/lib/server/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  return forwardToApi(req, `/seller/products/${params.id}`);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return forwardToApi(req, `/seller/products/${params.id}`);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  return forwardToApi(req, `/seller/products/${params.id}`);
}
