import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import type { UserRole } from "@prisma/client";
import { prisma } from "../db/prisma.js";
import { AppError } from "../utils/errors.js";
import { auth as betterAuth } from "../lib/auth.js";

/**
 * JWT cookie helpers + auth middleware.
 *
 * Phase 13.2 — Express owns the cookie. The browser hits the BFF
 * (apps/web /api/auth/login) which forwards to here; this file
 * issues the cookie via Set-Cookie. Future requests from the BFF
 * include the cookie via apiFetch's `headers().get("cookie")`
 * forwarding, so `requireAuth` can verify the JWT on protected
 * routes.
 *
 * Phase 14.2 — DUAL-STACK fallback. We accept EITHER:
 *   • our hand-rolled `metu_auth` JWT cookie (password-login path,
 *     unchanged from Phase 13.2)
 *   • better-auth's session cookie (Google sign-in path, new in
 *     Phase 14)
 *
 * requireAuth() tries the JWT first (no DB roundtrip on hit), then
 * falls back to `auth.api.getSession({ headers })`. New password
 * users keep getting JWTs via /auth/login; new Google users get
 * better-auth's session via the catch-all at /auth/better/*.
 *
 * Pure Mode A (drop the JWT entirely, better-auth owns sessions)
 * stays an option for a later phase — the dual stack lets us ship
 * Google login WITHOUT rewriting any of the 112 existing tests
 * that mint JWT cookies via jsonwebtoken.
 */

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-only-fallback-secret";
const COOKIE_NAME = "metu_auth";
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export type TokenPayload = {
  uid: number;
  role: UserRole;
};

export function issueToken(res: Response, payload: TokenPayload) {
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    // We deliberately omit `domain` so the cookie is scoped to the
    // response's host — the BFF forwards the Set-Cookie header to the
    // browser, which sees it as coming from metu.fly.dev (the BFF's
    // origin) and stores it for that origin only. Setting an explicit
    // domain breaks the cross-origin proxy pattern.
    secure: process.env.NODE_ENV === "production",
    maxAge: ONE_WEEK_MS,
    path: "/",
  });
}

export function clearToken(res: Response) {
  res.clearCookie(COOKIE_NAME, { path: "/" });
}

export function readToken(req: Request): TokenPayload | null {
  const raw = req.cookies?.[COOKIE_NAME];
  if (!raw) return null;
  try {
    return jwt.verify(raw, JWT_SECRET) as TokenPayload;
  } catch {
    return null;
  }
}

/**
 * Phase 14.2 — read better-auth's session cookie. Returns the
 * user.id (mapped to our userId Int) when a session is active,
 * null otherwise. We don't use better-auth's own role concept —
 * roles still come from our UserStats.role row, looked up in the
 * requireAuth middleware after the user is resolved.
 *
 * Wraps `auth.api.getSession({ headers })` which talks to its
 * own session table. Costs a single Prisma SELECT on the session
 * table per call (less than the JWT path needs to hit the user
 * table anyway, so net latency is comparable).
 */
async function readBetterAuthUserId(req: Request): Promise<number | null> {
  try {
    // better-auth needs Headers, not Express's IncomingHttpHeaders.
    // Forward the cookie + everything else 1:1.
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) {
      if (typeof v === "string") headers.set(k, v);
      else if (Array.isArray(v)) headers.set(k, v.join(", "));
    }
    const result = await betterAuth.api.getSession({ headers });
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
 * Reject the request with `AppError(401)` when no valid cookie is
 * present, or `AppError(403)` when the role doesn't match the
 * `roles` allowlist. Attaches `req.auth` (the JWT payload) and
 * `req.user` (the full Prisma row) for downstream handlers.
 */
export function requireAuth(roles?: UserRole[]) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      // Path 1 (fast, no DB) — try the JWT cookie first.
      let uid: number | null = null;
      const jwtPayload = readToken(req);
      if (jwtPayload) {
        uid = jwtPayload.uid;
      } else {
        // Path 2 (DB-backed) — fall back to better-auth's session.
        // Phase 14.2 dual-stack: Google sign-in users get a
        // better-auth session cookie via the catch-all; password
        // users still get our JWT via /auth/login.
        uid = await readBetterAuthUserId(req);
      }
      if (uid === null) throw new AppError(401, "Unauthorized");

      const user = await prisma.user.findUnique({
        where: { userId: uid },
        include: { stats: true, store: true },
      });
      // Soft-deleted users get treated as logged-out — same surface as
      // a fresh request with no cookie.
      if (!user || user.deletedAt) throw new AppError(401, "Unauthorized");

      // Role check uses the resolved user's stats, not the JWT
      // payload — handles the case where a Google sign-in user
      // has no JWT (so no payload.role) or where an admin demoted
      // a user mid-session.
      const role = (jwtPayload?.role ?? user.stats?.role ?? "buyer") as UserRole;
      if (roles && !roles.includes(role)) {
        throw new AppError(403, "Forbidden");
      }

      // Synthesize a TokenPayload-shaped req.auth so downstream
      // controllers don't need to know which path resolved the user.
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
    // Same dual-stack as requireAuth — JWT first, better-auth fallback.
    const jwtPayload = readToken(req);
    const uid = jwtPayload?.uid ?? (await readBetterAuthUserId(req));
    if (uid === null || uid === undefined) {
      next();
      return;
    }
    try {
      const user = await prisma.user.findUnique({
        where: { userId: uid },
        include: { stats: true, store: true },
      });
      if (user && !user.deletedAt) {
        const role = (jwtPayload?.role ?? user.stats?.role ?? "buyer") as UserRole;
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
