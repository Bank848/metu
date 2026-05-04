/**
 * forwarder to Express `GET /orders/:id`. Ownership
 * gate (404 when the order belongs to a different user) is enforced
 * server-side via the `cart.userId` join.
 */
import { type NextRequest } from "next/server";
import { forwardToApi } from "@/lib/server/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  return forwardToApi(req, `/orders/${params.id}`);
}
