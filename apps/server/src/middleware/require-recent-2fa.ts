import type { Request, Response, NextFunction } from "express";
import { prisma } from "../db/prisma.js";
import { auth as betterAuth } from "../lib/auth.js";
import { AppError } from "../utils/errors.js";

// TOTP step-up middleware: requires a recent TOTP code on top of a
// valid session before sensitive actions go through. Pass-through
// for users without 2FA enrolled.

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

      // Step-up only matters once 2FA is enrolled.
      if (!user.totpEnabled) return next();

      const sessionId = await readBetterAuthSessionId(req);
      if (sessionId === null) {
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
