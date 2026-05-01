import { NextResponse, type NextRequest } from "next/server";

// Forwards a BFF /api request to the Express API and threads cookies back.

const API_BASE = process.env.INTERNAL_API_URL ?? "http://localhost:4000";

// Forward to the API, mirror the body, re-emit every Set-Cookie.
export async function forwardToApi(
  req: NextRequest,
  apiPath: string,
): Promise<NextResponse> {
  // Origin is required by better-auth's CSRF check.
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

  // redirect:manual so OAuth 302s reach the browser instead of getting collapsed.
  const upstream = await fetch(`${API_BASE}${apiPath}`, { ...init, redirect: "manual" });
  const text = await upstream.text();
  const res = new NextResponse(text, {
    status: upstream.status,
    headers: {
      "Content-Type":
        upstream.headers.get("content-type") ?? "application/json",
    },
  });
  // Pass through download + redirect headers; Set-Cookie via getSetCookie() (it repeats).
  for (const h of ["content-disposition", "cache-control", "location"] as const) {
    const v = upstream.headers.get(h);
    if (v) res.headers.set(h, v);
  }
  const cookies = (upstream.headers as any).getSetCookie?.() ?? [];
  for (const c of cookies) res.headers.append("set-cookie", c);
  return res;
}
