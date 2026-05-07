import type { Request, Response, NextFunction } from "express";
import type { UserRole } from "@prisma/client";
import { prisma } from "../db/prisma.js";
import { AppError } from "../utils/errors.js";
import { auth as betterAuth } from "../lib/auth.js";

// requireAuth/softAuth read better-auth's session via
// auth.api.getSession({ headers }). better-auth owns every session.

export type TokenPayload = {
  uid: number;
  role: UserRole;
};

// Build a Web Headers object from Express's IncomingHttpHeaders.
function expressHeadersToFetch(req: Request): Headers {
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (typeof v === "string") headers.set(k, v);
    else if (Array.isArray(v)) headers.set(k, v.join(", "));
  }
  return headers;
}

export { expressHeadersToFetch };

// Forward Set-Cookie headers from a better-auth Web Response onto
// the Express response. appendHeader so multi-cookie responses
// (session + csrf + dontRememberMe) all land intact.
export function forwardSetCookieHeaders(res: Response, webResponse: { headers: { getSetCookie?: () => string[] } }) {
  const headers = webResponse.headers;
  if (!headers || typeof headers.getSetCookie !== "function") return;
  const setCookies = headers.getSetCookie();
  for (const cookie of setCookies) {
    res.appendHeader("set-cookie", cookie);
  }
}

// Returns the user.id (Int) when a session is active, null otherwise.
async function readBetterAuthUserId(req: Request): Promise<number | null> {
  try {
    const result = await betterAuth.api.getSession({ headers: expressHeadersToFetch(req) });
    if (!result?.session || !result.user) return null;
    // better-auth's API returns id as a string even with serial Int PKs.
    const uid = Number(result.user.id);
    return Number.isFinite(uid) ? uid : null;
  } catch {
    return null;
  }
}

/**
 * Reject with 401 when no session, 403 when role isn't allowed.
 * Attaches req.auth and req.user for downstream handlers.
 */
export function requireAuth(roles?: UserRole[]) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const uid = await readBetterAuthUserId(req);
      if (uid === null) throw new AppError(401, "Unauthorized");

      // Slim shape — middleware only needs auth + role + store presence.
      // Full user object (with bio + addresses) was 54KB on /auth/me
      // and ran on every authed request. The store join is kept (slim:
      // storeId only) because requireStore() downstream gates /seller/**
      // on its presence and seller controllers read `.storeId`.
      const user = await prisma.user.findUnique({
        where: { userId: uid },
        select: {
          userId: true,
          email: true,
          firstName: true,
          lastName: true,
          username: true,
          profileImage: true,
          bannedAt: true,
          stats: { select: { role: true } },
          store: { select: { storeId: true } },
        },
      });
      // Banned users get treated as logged-out.
      if (!user || user.bannedAt) {
        throw new AppError(401, "Unauthorized");
      }

      const role = ((user.stats?.role ?? "buyer") as UserRole);
      if (roles && !roles.includes(role)) {
        throw new AppError(403, "Forbidden");
      }

      (req as any).auth = { uid, role } as TokenPayload;
      (req as any).user = user;
      next();
    } catch (err) {
      next(err);
    }
  };
}

// Attaches the user when logged in; never rejects.
export function softAuth() {
  return async (req: Request, _res: Response, next: NextFunction) => {
    const uid = await readBetterAuthUserId(req);
    if (uid === null) {
      next();
      return;
    }
    try {
      const user = await prisma.user.findUnique({
        where: { userId: uid },
        select: {
          userId: true,
          email: true,
          firstName: true,
          lastName: true,
          username: true,
          profileImage: true,
          bannedAt: true,
          stats: { select: { role: true } },
          store: { select: { storeId: true } },
        },
      });
      if (user && !user.bannedAt) {
        const role = (user.stats?.role ?? "buyer") as UserRole;
        (req as any).auth = { uid, role } as TokenPayload;
        (req as any).user = user;
      }
    } catch {
      /* soft auth never throws */
    }
    next();
  };
}

export function currentUser(req: Request) {
  return (req as any).user ?? null;
}

export function currentAuth(req: Request): TokenPayload | null {
  return (req as any).auth ?? null;
}
