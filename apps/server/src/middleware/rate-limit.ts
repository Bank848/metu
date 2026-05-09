import type { Request, Response, NextFunction } from "express";
import { clientIp } from "../utils/client-ip.js";

// Sliding-window rate limiter, in-process Map keyed by IP. Sends a
// 429 directly with the canonical body shape ({ error, retryAfter })
// and a Retry-After header.

interface LimiterOptions {
  /** Max requests allowed within `windowMs`. */
  max: number;
  /** Window length in milliseconds. */
  windowMs: number;
  /** Optional key override; defaults to req.ip. */
  keyFn?: (req: Request) => string;
  /** When true, the limiter throttles even under NODE_ENV=test. */
  enforceInTests?: boolean;
}

// One Map per limiter identity so login + register don't share state.
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
  // clientIp() canonicalizes the Fly-Client-IP / XFF / req.ip chain.
  return clientIp(req) ?? "unknown";
}

export function rateLimit(options: LimiterOptions) {
  const { max, windowMs } = options;
  const keyFn = options.keyFn ?? defaultKey;
  const buckets = bucketsFor(options);

  return (req: Request, res: Response, next: NextFunction) => {
    // Bypass under tests unless `enforceInTests` is set.
    if (process.env.NODE_ENV === "test" && !options.enforceInTests) {
      next();
      return;
    }
    const key = keyFn(req);
    const now = Date.now();
    const cutoff = now - windowMs;

    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { hits: [] };
      buckets.set(key, bucket);
    }

    while (bucket.hits.length > 0 && bucket.hits[0] <= cutoff) {
      bucket.hits.shift();
    }

    if (bucket.hits.length >= max) {
      const earliest = bucket.hits[0];
      // Round up so Retry-After stays a whole-second value.
      const retryAfterSec = Math.max(1, Math.ceil((earliest + windowMs - now) / 1000));
      res.setHeader("Retry-After", String(retryAfterSec));
      res.status(429).json({ error: "RateLimited", retryAfter: retryAfterSec });
      return;
    }

    bucket.hits.push(now);
    res.setHeader("X-RateLimit-Limit", String(max));
    res.setHeader("X-RateLimit-Remaining", String(max - bucket.hits.length));

    // Opportunistic sweep so the Map doesn't grow unbounded.
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

// Singleton limiters: requestOtpLimiter is shared across /request-otp
// + /request-email-otp + /login/request-otp so cost can't be amplified
// by hopping endpoints.
export const registerLimiter = rateLimit({ max: 3, windowMs: 60_000 });
export const requestOtpLimiter = rateLimit({ max: 3, windowMs: 60_000 });
// Legacy aliases for back-compat imports; new routes should call makeLimiter().
export const loginLimiter = rateLimit({ max: 5, windowMs: 60_000 });
export const forgotPasswordLimiter = rateLimit({
  max: 3,
  windowMs: 5 * 60_000,
});

/** Per-route limiter factory — each call returns its own bucket map. */
export function makeLimiter(options: { max: number; windowMs: number }) {
  return rateLimit({ max: options.max, windowMs: options.windowMs });
}
