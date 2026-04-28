import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import type { UserRole } from "@prisma/client";
import { prisma } from "../db/prisma.js";
import { AppError } from "../utils/errors.js";

/**
 * JWT cookie helpers + auth middleware.
 *
 * Phase 13.2 — Express owns the cookie. The browser hits the BFF
 * (apps/web /api/auth/login) which forwards to here; this file
 * issues the cookie via Set-Cookie. Future requests from the BFF
 * include the cookie via apiFetch's `headers().get("cookie")`
 * forwarding, so `requireAuth` can verify the JWT on protected
 * routes.
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
 * Reject the request with `AppError(401)` when no valid cookie is
 * present, or `AppError(403)` when the role doesn't match the
 * `roles` allowlist. Attaches `req.auth` (the JWT payload) and
 * `req.user` (the full Prisma row) for downstream handlers.
 */
export function requireAuth(roles?: UserRole[]) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const payload = readToken(req);
      if (!payload) throw new AppError(401, "Unauthorized");
      if (roles && !roles.includes(payload.role)) {
        throw new AppError(403, "Forbidden");
      }
      const user = await prisma.user.findUnique({
        where: { userId: payload.uid },
        include: { stats: true, store: true },
      });
      // Soft-deleted users get treated as logged-out — same surface as
      // a fresh request with no cookie.
      if (!user || user.deletedAt) throw new AppError(401, "Unauthorized");

      (req as any).auth = payload;
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
    const payload = readToken(req);
    if (payload) {
      (req as any).auth = payload;
      try {
        const user = await prisma.user.findUnique({
          where: { userId: payload.uid },
          include: { stats: true, store: true },
        });
        if (user && !user.deletedAt) (req as any).user = user;
      } catch {
        /* ignore */
      }
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
