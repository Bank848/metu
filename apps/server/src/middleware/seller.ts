import type { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/errors.js";
import { currentUser, currentAuth } from "./auth.js";

/**
 * /seller/** guard. Mount after requireAuth(); checks req.user.store
 * and surfaces it on req.store for downstream handlers.
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
