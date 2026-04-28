import type { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/errors.js";
import { currentUser, currentAuth } from "./auth.js";

/**
 * Phase 13.9 — guard for /seller/** routes. Builds on requireAuth()
 * (which loads req.user with `include: { store: true }`); just
 * verifies the user owns a store and surfaces it as req.store for
 * downstream handlers.
 *
 * Use AFTER requireAuth() in the router chain — readToken alone is
 * not enough because we need the Prisma row to know about the store.
 */
export function requireStore() {
  return (req: Request, _res: Response, next: NextFunction) => {
    const auth = currentAuth(req);
    const user = currentUser(req);
    if (!auth || !user) return next(new AppError(401, "Unauthorized"));
    if (!user.store) {
      return next(
        new AppError(
          403,
          "NoStore",
          "Create a store first via POST /seller/become-seller",
        ),
      );
    }
    (req as any).store = user.store;
    next();
  };
}

export function currentStore(req: Request) {
  return (req as any).store ?? null;
}
