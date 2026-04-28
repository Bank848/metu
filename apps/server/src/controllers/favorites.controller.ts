import type { RequestHandler } from "express";
import * as service from "../services/favorites.service.js";
import { currentAuth } from "../middleware/auth.js";
import { AppError } from "../utils/errors.js";

/**
 * GET /favorites — list the current user's favourited productIds.
 * Light response shape because /favorites page hydrates full
 * products via direct catalog queries; this endpoint just tells
 * client components which hearts to render filled.
 */
export const list: RequestHandler = async (req, res, next) => {
  try {
    const auth = currentAuth(req);
    if (!auth) throw new AppError(401, "Unauthorized");
    const productIds = await service.listForUser(auth.uid);
    res.json({ productIds });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /favorites/:productId — heart the product. Idempotent.
 */
export const add: RequestHandler<{ productId: string }> = async (req, res, next) => {
  try {
    const auth = currentAuth(req);
    if (!auth) throw new AppError(401, "Unauthorized");
    const productId = Number(req.params.productId);
    if (!Number.isFinite(productId)) throw new AppError(400, "BadId");
    await service.addFavorite(auth.uid, productId);
    res.json({ ok: true, favorited: true });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /favorites/:productId — un-heart. Silent no-op if absent.
 */
export const remove: RequestHandler<{ productId: string }> = async (req, res, next) => {
  try {
    const auth = currentAuth(req);
    if (!auth) throw new AppError(401, "Unauthorized");
    const productId = Number(req.params.productId);
    if (!Number.isFinite(productId)) throw new AppError(400, "BadId");
    await service.removeFavorite(auth.uid, productId);
    res.json({ ok: true, favorited: false });
  } catch (err) {
    next(err);
  }
};
