/**
 * Phase 48 — Network-layer ban check.
 *
 * Mounted FIRST in the middleware chain (in app.ts) so blocked IPs
 * never reach auth, body parsing, or any business logic. Uses the
 * cache exposed by `banned-ip.service.ts`; DB only sees one lookup
 * per banned IP per minute under sustained traffic.
 *
 * Skipped for:
 *   - the Stripe webhook endpoint (Stripe's outbound IPs have no
 *     reason to be banned and we don't want a manual ban to break
 *     payment status updates).
 *   - the health endpoint (Fly's prober ping must always pass).
 */
import type { Request, Response, NextFunction } from "express";
import { isIpBanned } from "../services/banned-ip.service.js";

const SKIP_PATHS = new Set<string>([
  "/api/webhooks/stripe",
  "/health",
  "/healthz",
]);

export async function ipBanCheck(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (SKIP_PATHS.has(req.path)) {
    next();
    return;
  }
  // Audit follow-up (HIGH #4) — original code returned next() when
  // req.ip was empty, which let a forged `X-Forwarded-For: ,` slip
  // past the ban list. Fall back to the raw socket address; if both
  // are empty something is very wrong with the proxy chain — log
  // and continue rather than 400 (we don't want to break health
  // probers or local-dev requests). The audit feed will show the
  // empty-ip path so the operator can investigate.
  let ip = (req.ip ?? "").trim();
  if (!ip) {
    ip = (req.socket?.remoteAddress ?? "").trim();
  }
  if (!ip) {
    console.warn("[ipBanCheck] request with empty IP — letting through:", req.path);
    next();
    return;
  }
  try {
    if (await isIpBanned(ip)) {
      res.status(403).json({ error: "IpBanned", message: "Access denied." });
      return;
    }
  } catch (err) {
    // Don't fail-closed on a DB blip — if the cache lookup throws we
    // log + let the request through. Better to risk a transient pass
    // than to take the whole API down because banned_ip is sluggish.
    console.error("[ipBanCheck] cache lookup failed:", err);
  }
  next();
}
