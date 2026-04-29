import type { Request, Response, NextFunction } from "express";
import type { UserRole } from "@prisma/client";
import { prisma } from "../db/prisma.js";
import { AppError } from "../utils/errors.js";
import { auth as betterAuth } from "../lib/auth.js";

/**
 * Auth middleware.
 *
 * Phase 13.2 — Express owns the cookie. Phase 14.2 added better-auth
 * as a dual-stack option for Google sign-ins.
 *
 * Phase 16.3 — Mode A swap: better-auth owns *every* session now.
 * The hand-rolled JWT cookie is gone. requireAuth()/softAuth() read
 * better-auth's session via `auth.api.getSession({ headers })`. The
 * tradeoff was a one-shot logout for any user holding a stale JWT
 * cookie — since better-auth never issued one for them, it can't
 * resolve the request and they're treated as anonymous.
 *
 * Helper functions exposed:
 *   • readBetterAuthUserId(req)         — null when no session
 *   • forwardSetCookieHeaders(res, web) — copy Set-Cookie from a Web
 *                                          Response (returned by
 *                                          better-auth's *.asResponse
 *                                          API calls) onto Express's
 *                                          response so the browser
 *                                          actually sees the cookie.
 */

export type TokenPayload = {
  uid: number;
  role: UserRole;
};

/**
 * Build a Headers object from Express's IncomingHttpHeaders so we can
 * hand it to better-auth's API surface (which speaks Web Fetch types,
 * not Node's). Cookie + everything else copied 1:1.
 */
function expressHeadersToFetch(req: Request): Headers {
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (typeof v === "string") headers.set(k, v);
    else if (Array.isArray(v)) headers.set(k, v.join(", "));
  }
  return headers;
}

export { expressHeadersToFetch };

/**
 * Forward every Set-Cookie header from a better-auth Web Response
 * onto an Express response. Used after every signInEmail / signUpEmail
 * / signOut call so the browser actually receives + stores / clears
 * better-auth's session cookie.
 *
 * better-auth (via Hono) signs cookies with the BETTER_AUTH_SECRET;
 * we don't unpack or re-sign them here — just pass through verbatim.
 * appendHeader instead of cookie() so multiple cookies (session +
 * dontRememberMe + csrf) all land on the wire intact.
 */
export function forwardSetCookieHeaders(res: Response, webResponse: { headers: { getSetCookie?: () => string[] } }) {
  const headers = webResponse.headers;
  if (!headers || typeof headers.getSetCookie !== "function") return;
  const setCookies = headers.getSetCookie();
  for (const cookie of setCookies) {
    res.appendHeader("set-cookie", cookie);
  }
}

/**
 * Read better-auth's session cookie. Returns the user.id (mapped to
 * our userId Int) when a session is active, null otherwise. We don't
 * use better-auth's own role concept — roles still come from
 * UserStats.role, looked up in requireAuth() after the user resolves.
 *
 * Wraps `auth.api.getSession({ headers })` which costs a single
 * Prisma SELECT on the session table per call.
 */
async function readBetterAuthUserId(req: Request): Promise<number | null> {
  try {
    const result = await betterAuth.api.getSession({ headers: expressHeadersToFetch(req) });
    if (!result?.session || !result.user) return null;
    // user.id is a string in better-auth's API even with our serial
    // Int IDs (per docs note: "Better-Auth will continue to infer
    // the type of the id field as a string for the database, but
    // will automatically convert it to a numeric type when
    // fetching or inserting data.")
    const uid = Number(result.user.id);
    return Number.isFinite(uid) ? uid : null;
  } catch {
    return null;
  }
}

/**
 * Reject the request with `AppError(401)` when no valid better-auth
 * session is present, or `AppError(403)` when the role doesn't match
 * the `roles` allowlist. Attaches `req.auth` ({uid,role}) and
 * `req.user` (the full Prisma row including stats + store) for
 * downstream handlers.
 */
export function requireAuth(roles?: UserRole[]) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const uid = await readBetterAuthUserId(req);
      if (uid === null) throw new AppError(401, "Unauthorized");

      const user = await prisma.user.findUnique({
        where: { userId: uid },
        include: { stats: true, store: true },
      });
      // Soft-deleted users get treated as logged-out — same surface
      // as a fresh request with no cookie.
      if (!user || user.deletedAt) throw new AppError(401, "Unauthorized");

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

/**
 * Soft auth — attaches user if logged in, never rejects. Used by
 * routes that show personalised data when available but stay public
 * (e.g. catalog browse with "favourited" hearts pre-filled).
 */
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
        include: { stats: true, store: true },
      });
      if (user && !user.deletedAt) {
        const role = (user.stats?.role ?? "buyer") as UserRole;
        (req as any).auth = { uid, role } as TokenPayload;
        (req as any).user = user;
      }
    } catch {
      /* ignore — soft auth never throws */
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
