/**
 * Phase 13.3 — forwarder to Express `POST /coupons/validate`.
 * Always 200 with `{ valid, reason? }` so the cart UI surfaces
 * rejection reasons inline.
 */
import { type NextRequest } from "next/server";
import { forwardToApi } from "@/lib/server/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  return forwardToApi(req, "/coupons/validate");
}
