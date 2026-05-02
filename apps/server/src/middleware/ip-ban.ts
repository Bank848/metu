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
  const ip = (req.ip ?? "").trim();
  if (!ip) {
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
