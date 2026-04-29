import type { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/errors.js";

/**
 * Phase 15.1 — sliding-window rate limiter.
 *
 * In-memory (per-process) Map keyed by IP. No Redis — the plan
 * decided this back in Phase D and Phase 15's refinement reaffirmed
 * it: simpler, free, restart-resets on bounce (acceptable for the
 * demo). For multi-instance production we'd swap to Redis or just
 * tolerate the sloppy per-instance counters.
 *
 * Sliding window (not fixed window) = a request "expires" out of the
 * counter exactly `windowMs` after it was made. No bucket boundaries,
 * so the rate is enforced uniformly with no edge-of-window bursts.
 *
 * Sweep policy: every check on a key prunes timestamps older than
 * `windowMs`. Keys with empty arrays after the prune get deleted so
 * the Map doesn't grow unbounded across long-tail IPs that hit once
 * and never again. Memory complexity is O(active limited requests
 * within the largest window) — bounded by traffic, not by uptime.
 *
 * Throws AppError(429, "RateLimited") which the existing error
 * handler turns into a JSON response. We also set the Retry-After
 * header on the underlying response so well-behaved clients (and
 * humans testing with curl -i) can see when to retry.
 */

interface LimiterOptions {
  /** Max requests allowed within `windowMs`. */
  max: number;
  /** Window length in milliseconds. */
  windowMs: number;
  /**
   * Optional override for the key — defaults to remote IP. Useful
   * when a route should rate-limit by something else (e.g. email
   * for forgot-password, so an attacker can't bypass by rotating IPs
   * — though we keep IP-based for now since IP-rotation would also
   * spread load on Twilio/email providers, which are the actual
   * cost we're protecting).
   */
  keyFn?: (req: Request) => string;
}

// One Map per (route + window-config). Keyed by some opaque limiter
// identity so multiple routes don't share state — login + register
// each get their own counter even at the same IP.
type Bucket = { hits: number[] };
const limiters = new WeakMap<LimiterOptions, Map<string, Bucket>>();

function bucketsFor(options: LimiterOptions): Map<string, Bucket> {
  let m = limiters.get(options);
  if (!m) {
    m = new Map();
    limiters.set(options, m);
  }
  return m;
}

function defaultKey(req: Request): string {
  // Express's req.ip respects trust proxy. On Fly we sit behind a
  // proxy that sets X-Forwarded-For; we trust it (set in app.ts via
  // app.set('trust proxy', true)) so the real client IP comes
  // through here.
  return req.ip ?? "unknown";
}

export function rateLimit(options: LimiterOptions) {
  const { max, windowMs } = options;
  const keyFn = options.keyFn ?? defaultKey;
  const buckets = bucketsFor(options);

  return (req: Request, res: Response, next: NextFunction) => {
    const key = keyFn(req);
    const now = Date.now();
    const cutoff = now - windowMs;

    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { hits: [] };
      buckets.set(key, bucket);
    }

    // Prune expired hits in-place. Keeps the array bounded by `max+1`
    // even under sustained traffic (we never push past max+1 because
    // we reject the moment we'd exceed).
    while (bucket.hits.length > 0 && bucket.hits[0] <= cutoff) {
      bucket.hits.shift();
    }

    if (bucket.hits.length >= max) {
      // Time until the OLDEST hit slides out of the window. Round up
      // to the nearest second so Retry-After is honoured by every HTTP
      // client (some choke on fractional seconds).
      const earliest = bucket.hits[0];
      const retryAfterSec = Math.max(1, Math.ceil((earliest + windowMs - now) / 1000));
      res.setHeader("Retry-After", String(retryAfterSec));
      return next(
        new AppError(429, "RateLimited", `Try again in ${retryAfterSec}s`),
      );
    }

    bucket.hits.push(now);
    // Surface remaining quota too — useful for debugging + good
    // citizenship. Headers ignored by the existing error handler so
    // setting them on rejected responses doesn't conflict.
    res.setHeader("X-RateLimit-Limit", String(max));
    res.setHeader("X-RateLimit-Remaining", String(max - bucket.hits.length));

    // Sweep empty buckets opportunistically (1% of requests) so the
    // Map doesn't grow unbounded for long-tail IPs.
    if (Math.random() < 0.01) sweep(buckets, cutoff);

    next();
  };
}

function sweep(buckets: Map<string, Bucket>, cutoff: number) {
  for (const [k, b] of buckets) {
    while (b.hits.length > 0 && b.hits[0] <= cutoff) b.hits.shift();
    if (b.hits.length === 0) buckets.delete(k);
  }
}

// Pre-baked limiters for the routes Phase 15.1 protects. Exporting
// them as singletons (not factory calls) is what makes per-route
// state actually persist across requests — a fresh `rateLimit({...})`
// per route would build a fresh WeakMap entry every time and counters
// would never accumulate.
export const loginLimiter = rateLimit({ max: 5, windowMs: 60_000 });
export const registerLimiter = rateLimit({ max: 3, windowMs: 60_000 });
export const requestOtpLimiter = rateLimit({ max: 3, windowMs: 60_000 });
export const forgotPasswordLimiter = rateLimit({
  max: 3,
  windowMs: 5 * 60_000,
});

// ──────────────────────────────────────────────────────────────────
//  Phase 26 — removed: sendMessageLimiter (messages cut),
//  submitTopupLimiter + submitWithdrawLimiter (PromptPay/coin layer
//  cut). Stripe writes (payment intent, refund) get their own
//  user-keyed limiters in Phase 27.
// ──────────────────────────────────────────────────────────────────
