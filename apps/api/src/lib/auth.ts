import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import type { UserRole } from "@prisma/client";
import { prisma } from "./prisma.js";

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
    const decoded = jwt.verify(raw, JWT_SECRET) as TokenPayload;
    return decoded;
  } catch {
    return null;
  }
}

// Authenticate middleware — attaches req.auth and req.user.
export function requireAuth(roles?: UserRole[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const payload = readToken(req);
    if (!payload) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    if (roles && !roles.includes(payload.role)) {
      res.status(403).json({ error: "Forbidden", need: roles });
      return;
    }
    (req as any).auth = payload;
    try {
      const user = await prisma.user.findUnique({
        where: { userId: payload.uid },
        include: { stats: true, store: true },
      });
      if (!user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      (req as any).user = user;
      next();
    } catch (err) {
      next(err);
    }
  };
}

// Soft auth — attaches user if logged in, never rejects.
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
        if (user) (req as any).user = user;
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
