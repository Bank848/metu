import type { Request, Response, NextFunction } from "express";
import { prisma } from "../db/prisma.js";
import { auth as betterAuth } from "../lib/auth.js";
import { AppError } from "../utils/errors.js";

/**
 * Phase 23.3 — TOTP step-up middleware.
 *
 * Wraps sensitive route handlers (withdrawal, change-password,
 * unlink Google, delete account) so the action requires a fresh
 * TOTP proof regardless of how recently the user signed in.
 *
 * Behaviour:
 *   1. If the user has not enrolled in TOTP (`totpEnabled=false`),
 *      the middleware passes through. Step-up only gates accounts
 *      that have opted into the extra security layer.
 *   2. Reads the better-auth session token + looks up `lastTotpAt`.
 *   3. If `lastTotpAt` is NULL or older than `maxAgeMinutes`, throws
 *      403 TotpStepUpRequired. The client catches this code and
 *      renders the step-up modal which calls /auth/totp/step-up
 *      with a fresh 6-digit code, then retries the original request.
 *
 * Why a separate timestamp from sign-in TOTP: defence in depth.
 * Sign-in TOTP proves "I am the account holder right now". Step-up
 * TOTP proves "I currently authorise THIS sensitive action". A
 * stolen session cookie shouldn't grant blanket sensitive-action
 * access just because the original sign-in passed 2FA — the
 * attacker would still need the authenticator app to step up.
 */

/**
 * Best-effort read of the better-auth session row id from the
 * incoming request. Returns null when the user is on the legacy
 * JWT cookie path (no better-auth session row to record against).
 */
async function readBetterAuthSessionId(req: Request): Promise<number | null> {
  try {
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) {
      if (typeof v === "string") headers.set(k, v);
      else if (Array.isArray(v)) headers.set(k, v.join(", "));
    }
    const result = await betterAuth.api.getSession({ headers });
    if (!result?.session?.id) return null;
    const id = Number(result.session.id);
    return Number.isFinite(id) ? id : null;
  } catch {
    return null;
  }
}

export function requireRecent2FA(maxAgeMinutes: number) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const auth = (req as { auth?: { uid?: number } }).auth;
      if (!auth?.uid) {
        throw new AppError(401, "Unauthorized");
      }

      const user = await prisma.user.findUnique({
        where: { userId: auth.uid },
        select: { totpEnabled: true },
      });
      if (!user) throw new AppError(401, "Unauthorized");

      // Step-up is meaningful only for accounts that opted into TOTP.
      // Users without 2FA enrolled fall through — they're protected
      // by the existing per-action guards (e.g. changePassword's
      // currentPassword + OTP gate).
      if (!user.totpEnabled) return next();

      const sessionId = await readBetterAuthSessionId(req);
      if (sessionId === null) {
        // Legacy JWT cookie path — no Session row to record against.
        // Force step-up via the modal's fallback handler (which routes
        // to a re-login when no Session.lastTotpAt exists).
        throw new AppError(
          403,
          "TotpStepUpRequired",
          "Re-verify your authenticator code to continue.",
        );
      }

      const session = await prisma.session.findUnique({
        where: { id: sessionId },
        select: { lastTotpAt: true },
      });
      if (!session) {
        throw new AppError(401, "Unauthorized");
      }

      const ageMs = session.lastTotpAt
        ? Date.now() - session.lastTotpAt.getTime()
        : Number.POSITIVE_INFINITY;
      if (ageMs > maxAgeMinutes * 60_000) {
        throw new AppError(
          403,
          "TotpStepUpRequired",
          "Re-verify your authenticator code to continue.",
        );
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}
