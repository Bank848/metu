import type { RequestHandler } from "express";
import { addToCartSchema, updateCartItemSchema } from "../models/cart.model.js";
import * as service from "../services/cart.service.js";
import { currentAuth } from "../middleware/auth.js";
import { AppError } from "../utils/errors.js";

/**
 * Cart endpoints — all authed (the route file applies requireAuth()
 * before each handler). Controllers grab the userId from the JWT
 * payload via `currentAuth(req)` so services stay request-agnostic.
 */

export const get: RequestHandler = async (req, res, next) => {
  try {
    const auth = currentAuth(req);
    if (!auth) throw new AppError(401, "Unauthorized");
    const result = await service.getCart(auth.uid);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const addItem: RequestHandler = async (req, res, next) => {
  try {
    const auth = currentAuth(req);
    if (!auth) throw new AppError(401, "Unauthorized");
    const parsed = addToCartSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, "ValidationError", parsed.error.message);
    }
    const result = await service.addItem(auth.uid, parsed.data);
    res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
};

export const updateItem: RequestHandler = async (req, res, next) => {
  try {
    const auth = currentAuth(req);
    if (!auth) throw new AppError(401, "Unauthorized");
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) throw new AppError(400, "BadId");
    const parsed = updateCartItemSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, "ValidationError", parsed.error.message);
    }
    const cartItem = await service.updateItem(auth.uid, id, parsed.data);
    res.json({ ok: true, cartItem });
  } catch (err) {
    next(err);
  }
};

export const removeItem: RequestHandler = async (req, res, next) => {
  try {
    const auth = currentAuth(req);
    if (!auth) throw new AppError(401, "Unauthorized");
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) throw new AppError(400, "BadId");
    await service.removeItem(auth.uid, id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};
