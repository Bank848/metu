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
  // Forward Origin so better-auth's CSRF check passes on social sign-in
  // POSTs (it rejects same-origin requests with "MISSING_OR_NULL_ORIGIN"
  // when the header is absent). Fall back to the BFF's own URL when the
  // browser didn't send one (curl, server-to-server probes).
  const incomingOrigin =
    req.headers.get("origin") ?? new URL(req.url).origin;

  const init: RequestInit = {
    method: req.method,
    headers: {
      "Content-Type":
        req.headers.get("content-type") ?? "application/json",
      origin: incomingOrigin,
      ...(req.headers.get("cookie") ? { cookie: req.headers.get("cookie")! } : {}),
      ...(req.headers.get("user-agent")
        ? { "user-agent": req.headers.get("user-agent")! }
        : {}),
    },
  };
  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = await req.text();
  }

  // Phase 14.2 — `redirect: "manual"` so we forward 302s straight to
  // the browser instead of letting fetch follow them. Critical for
  // OAuth flows: better-auth redirects to Google's authorize URL
  // and then back to the BFF callback path; we need the browser to
  // see each hop, not collapse them into a final 200.
  const upstream = await fetch(`${API_BASE}${apiPath}`, { ...init, redirect: "manual" });
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
  // Phase 14.2 — added `location` so OAuth redirects survive the hop.
  // Set-Cookie still uses getSetCookie() because cookies can repeat.
  for (const h of ["content-disposition", "cache-control", "location"] as const) {
    const v = upstream.headers.get(h);
    if (v) res.headers.set(h, v);
  }
  const cookies = (upstream.headers as any).getSetCookie?.() ?? [];
  for (const c of cookies) res.headers.append("set-cookie", c);
  return res;
}
