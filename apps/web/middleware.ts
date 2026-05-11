import { NextResponse, type NextRequest } from "next/server";

/**
 * Rate-limit the most-abused auth endpoints. In-memory sliding window
 * keyed by IP — fine for a demo because Fly typically pins us to a
 * single machine and Vercel-style cold starts aren't in play. If we
 * scale horizontally later, swap this for Upstash Redis or
 * @upstash/ratelimit.
 */

// path → max attempts per window (60s)
const LIMITS: Record<string, number> = {
  "/api/auth/login": 5,
  "/api/auth/register": 5,
  "/api/auth/forgot-password": 5,
};

const WINDOW_MS = 60_000;

// IP → array of timestamps within the rolling window
const buckets = new Map<string, number[]>();

// Periodic compaction so the Map doesn't grow unbounded across hours of
// uptime. Runs at most once per request that touches the limiter.
let lastSweep = 0;
function sweep(now: number) {
  if (now - lastSweep < 5 * WINDOW_MS) return;
  lastSweep = now;
  for (const [key, hits] of buckets) {
    const recent = hits.filter((t) => now - t < WINDOW_MS);
    if (recent.length === 0) buckets.delete(key);
    else buckets.set(key, recent);
  }
}

function clientIp(req: NextRequest): string {
  // Vercel + Fly both stash the real client IP in x-forwarded-for; the
  // first comma-separated value is the original client.
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

// Canonical host: traffic that lands on the Fly-issued *.fly.dev hostname
// gets a 301 to the marketplace's branded domain so the bare Fly URL
// doesn't get bookmarked / indexed.
const CANONICAL_HOST = "metu.online";
const FLY_HOST = "metu.fly.dev";

// CF edge-cache hint disabled on 2026-05-11 for the defense window.
//
// Why: Cloudflare Free plan only honours `Vary: Accept-Encoding`, not
// `Vary: Cookie`. That meant a freshly-logged-in user navigating back
// to /, /browse, /product/[id], or /store/[id] would receive the
// anonymous shell that CF had previously cached for those URLs —
// TopNav rendered as signed-out, /cart returned 401, the works.
//
// The middleware used to emit `Cache-Control: public, s-maxage=1800`
// only when no auth cookie was present, relying on Vary: Cookie to
// keep cookie-bearing requests off the shared slot. With Free's Vary
// limitation that was effectively cache-everyone-as-anonymous. Better
// to take the ~100 ms origin round-trip hit than ship a broken
// post-login UX. Restore this once we're on a CF plan with custom
// cache keys (Pro / Business) — see commit f44c3b... for the prior
// implementation.
function applyEdgeCacheHint(_req: NextRequest, res: NextResponse): NextResponse {
  return res;
}

export function middleware(req: NextRequest) {
  const host = req.headers.get("host") ?? "";
  if (host === FLY_HOST || host === `www.${FLY_HOST}`) {
    const url = req.nextUrl.clone();
    url.host = CANONICAL_HOST;
    url.protocol = "https:";
    url.port = "";
    return NextResponse.redirect(url, 301);
  }

  const limit = LIMITS[req.nextUrl.pathname];
  if (!limit) return applyEdgeCacheHint(req, NextResponse.next());

  const now = Date.now();
  sweep(now);

  const key = `${req.nextUrl.pathname}|${clientIp(req)}`;
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < WINDOW_MS);

  if (hits.length >= limit) {
    const oldest = hits[0];
    const retryAfter = Math.max(1, Math.ceil((oldest + WINDOW_MS - now) / 1000));
    return new NextResponse(
      JSON.stringify({
        error: "TooManyRequests",
        message: `Too many attempts. Try again in ${retryAfter}s.`,
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(retryAfter),
        },
      },
    );
  }

  hits.push(now);
  buckets.set(key, hits);
  return applyEdgeCacheHint(req, NextResponse.next());
}

// Run on every page + API request so the canonical-host redirect kicks
// in regardless of path. Skip Next.js internals + static assets so the
// build doesn't bloat redirects on bundled JS/CSS.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
