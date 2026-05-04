/**
 * full forwarders to Express:
 *   GET  /seller/products   (read, Phase 13.9.1)
 *   POST /seller/products   (write, Phase 13.9.2)
 */
import { type NextRequest } from "next/server";
import { forwardToApi } from "@/lib/server/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return forwardToApi(req, `/seller/products`);
}

export async function POST(req: NextRequest) {
  return forwardToApi(req, `/seller/products`);
}
