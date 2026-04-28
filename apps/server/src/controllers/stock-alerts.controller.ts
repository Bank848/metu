import type { RequestHandler } from "express";
import * as service from "../services/stock-alerts.service.js";
import { currentAuth } from "../middleware/auth.js";
import { AppError } from "../utils/errors.js";

/**
 * POST /stock-alerts/:productItemId — subscribe (auth, idempotent).
 */
export const subscribe: RequestHandler<{ productItemId: string }> = async (
  req,
  res,
  next,
) => {
  try {
    const auth = currentAuth(req);
    if (!auth) throw new AppError(401, "Unauthorized");
    const productItemId = Number(req.params.productItemId);
    if (!Number.isFinite(productItemId)) throw new AppError(400, "BadId");
    await service.subscribe(auth.uid, productItemId);
    res.json({ ok: true, subscribed: true });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /stock-alerts/:productItemId — unsubscribe.
 */
export const unsubscribe: RequestHandler<{ productItemId: string }> = async (
  req,
  res,
  next,
) => {
  try {
    const auth = currentAuth(req);
    if (!auth) throw new AppError(401, "Unauthorized");
    const productItemId = Number(req.params.productItemId);
    if (!Number.isFinite(productItemId)) throw new AppError(400, "BadId");
    await service.unsubscribe(auth.uid, productItemId);
    res.json({ ok: true, subscribed: false });
  } catch (err) {
    next(err);
  }
};
