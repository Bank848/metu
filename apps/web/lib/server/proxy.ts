import { NextResponse, type NextRequest } from "next/server";
import { INTERNAL_API_URL } from "../config";

// Forwards a BFF /api request to the Express API and threads cookies back.

const API_BASE = INTERNAL_API_URL;

// Forward to the API, mirror the body, re-emit every Set-Cookie.
export async function forwardToApi(
  req: NextRequest,
  apiPath: string,
): Promise<NextResponse> {
  // Origin is required by better-auth's CSRF check.
  const incomingOrigin =
    req.headers.get("origin") ?? new URL(req.url).origin;

  // Forward client IP markers so audit rows + rate-limit buckets on
  // the upstream API see the real visitor, not the BFF machine. Under
  // Fly.io, two reverse proxies sit in front; only Fly-Client-IP
  // carries the original visitor address. Without forwarding, every
  // /api/admin/* / /api/seller/* action records the BFF's IP.
  const flyIp = req.headers.get("fly-client-ip");
  const xff = req.headers.get("x-forwarded-for");
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
      ...(flyIp ? { "fly-client-ip": flyIp } : {}),
      ...(xff ? { "x-forwarded-for": xff } : {}),
    },
  };
  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = await req.text();
  }

  // redirect:manual so OAuth 302s reach the browser instead of getting collapsed.
  // explicit cache: "no-store" so the BFF's outbound
  // fetch is never reused from Next.js's data cache. Without this, GET
  // /api/cart was returning stale snapshots even on `dynamic = "force-
  // dynamic"` routes (writes via POST/DELETE went through fresh, but
  // the next GET re-read from a memoised result captured before the
  // writes landed).
  const upstream = await fetch(`${API_BASE}${apiPath}`, {
    ...init,
    redirect: "manual",
    cache: "no-store",
  });
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
  for (const c of cookies) {
    // better-auth's Set-Cookie carries `Domain=metu-api.fly.dev`
    // because the API runs on that host. When we mirror that header
    // verbatim through the BFF (served from metu.fly.dev), the browser
    // refuses to set a cookie for a sibling domain → OAuth state cookie
    // never persists → callback returns "state_mismatch". Strip the
    // Domain attribute so the cookie scopes to the BFF host instead.
    res.headers.append("set-cookie", stripDomainAttr(c));
  }
  return res;
}

function stripDomainAttr(cookie: string): string {
  return cookie
    .split(";")
    .filter((seg) => !/^\s*domain=/i.test(seg))
    .join(";");
}
