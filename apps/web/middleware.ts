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

export function middleware(req: NextRequest) {
  const limit = LIMITS[req.nextUrl.pathname];
  if (!limit) return NextResponse.next();

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
  return NextResponse.next();
}

// Only run middleware for the limited routes — saves overhead on every
// other request.
export const config = {
  matcher: ["/api/auth/login", "/api/auth/register", "/api/auth/forgot-password"],
};
