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

// Public catalog paths whose HTML is safe to cache for anonymous
// viewers at the Cloudflare edge (10 s window). Cookie-aware paths
// like /cart, /checkout, /admin, /seller stay off this list so a
// per-user render never lands in a shared CF slot.
const ANON_CACHEABLE = ["/", "/browse", "/product", "/store"];
const AUTH_COOKIE_RE = /(?:^|;\s*)(?:__Secure-)?better-auth\./;

function isAnonCacheable(pathname: string): boolean {
  if (pathname === "/") return true;
  return ANON_CACHEABLE.some(
    (p) => p !== "/" && (pathname === p || pathname.startsWith(p + "/")),
  );
}

function applyEdgeCacheHint(req: NextRequest, res: NextResponse): NextResponse {
  if (!isAnonCacheable(req.nextUrl.pathname)) return res;
  const cookieHeader = req.headers.get("cookie") ?? "";
  if (AUTH_COOKIE_RE.test(cookieHeader)) return res;
  // Anonymous + cacheable path: hint Cloudflare to cache the rendered
  // HTML for 10 s and serve stale up to 60 s while it revalidates in
  // the background. `Vary: Cookie` keeps any future cookie-bearing
  // visitor isolated on a different cache slot — defense in depth
  // above the auth-cookie check above.
  // max-age=0 forces the browser to revalidate every nav so it never
  // holds a stale public-shell render (CF Free's default Browser TTL
  // would otherwise prepend a 4 h browser cache); s-maxage=10 lets
  // Cloudflare's edge serve the cached HTML for 10 s, which is where
  // the actual TTFB win comes from.
  res.headers.set(
    "Cache-Control",
    "public, max-age=0, s-maxage=10, stale-while-revalidate=60",
  );
  res.headers.append("Vary", "Cookie");
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
