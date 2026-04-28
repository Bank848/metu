import { NextResponse, type NextRequest } from "next/server";

/**
 * Phase 13.2 — shared helper for the `/api/auth/*` proxy routes
 * (and any future BFF proxy that needs to forward Set-Cookie back
 * to the browser).
 *
 * Why proxy at all? See `apps/web/app/api/auth/login/route.ts` —
 * Express would Set-Cookie on the wrong origin if the browser
 * called it directly. The proxy makes the response look like it
 * came from the BFF.
 */

const API_BASE = process.env.INTERNAL_API_URL ?? "http://localhost:4000";

/**
 * Forward `req` to the API server at `apiPath`, mirror the body
 * back, and re-emit ALL Set-Cookie headers (cookies can repeat,
 * so we use `getSetCookie()` which returns an array).
 *
 * The inbound request's cookie header is forwarded too so endpoints
 * like `PATCH /auth/me` can resolve the session.
 */
export async function forwardToApi(
  req: NextRequest,
  apiPath: string,
): Promise<NextResponse> {
  const init: RequestInit = {
    method: req.method,
    headers: {
      "Content-Type":
        req.headers.get("content-type") ?? "application/json",
      ...(req.headers.get("cookie") ? { cookie: req.headers.get("cookie")! } : {}),
    },
  };
  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = await req.text();
  }

  const upstream = await fetch(`${API_BASE}${apiPath}`, init);
  const text = await upstream.text();
  const res = new NextResponse(text, {
    status: upstream.status,
    headers: {
      "Content-Type":
        upstream.headers.get("content-type") ?? "application/json",
    },
  });
  // Phase 13.9.1 — pass through download-related headers so the
  // /seller/orders/export CSV proxy keeps its file-download behaviour.
  // Set-Cookie still uses getSetCookie() because cookies can repeat.
  for (const h of ["content-disposition", "cache-control"] as const) {
    const v = upstream.headers.get(h);
    if (v) res.headers.set(h, v);
  }
  const cookies = (upstream.headers as any).getSetCookie?.() ?? [];
  for (const c of cookies) res.headers.append("set-cookie", c);
  return res;
}
