/**
 * Phase 13.4 — forwarder to Express:
 *   POST /orders → checkout (cart + coupon resolution + order +
 *                  transaction + cart re-roll all in one tx)
 *   GET  /orders → user's order history
 *
 * The legacy BFF version called `revalidatePath("/", "/health",
 * "/admin")` after a successful POST so the public counters bumped
 * within a minute. We keep that revalidation BFF-side because it's
 * a Next-cache-only concern (the Express server has no notion of
 * Next's data cache).
 */
import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { forwardToApi } from "@/lib/server/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const res = await forwardToApi(req, "/orders");
  // On a successful checkout the API returned 2xx — bust the Next
  // data cache for the surfaces that show order counts so the
  // homepage / admin / health KPI tiles refresh within the next
  // request, not after the next force-dynamic interval.
  if (res.status >= 200 && res.status < 300) {
    revalidatePath("/");
    revalidatePath("/health");
    revalidatePath("/admin");
  }
  return NextResponse.json(await res.json(), {
    status: res.status,
    headers: copyForwardedHeaders(res),
  });
}

export async function GET(req: NextRequest) {
  return forwardToApi(req, "/orders");
}

function copyForwardedHeaders(res: NextResponse): HeadersInit {
  // Set-Cookie roundtrip isn't needed for orders, but we keep the
  // helper symmetric with proxy.ts so future endpoints can opt in
  // without rewiring.
  const out: Record<string, string> = {};
  res.headers.forEach((v, k) => {
    if (k.toLowerCase() === "content-type") out[k] = v;
  });
  return out;
}
