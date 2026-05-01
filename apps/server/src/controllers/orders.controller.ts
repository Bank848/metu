import type { RequestHandler } from "express";
import { checkoutSchema } from "../models/orders.model.js";
import * as service from "../services/orders.service.js";
import { currentAuth } from "../middleware/auth.js";
import { AppError } from "../utils/errors.js";

/**
 * Orders endpoints — all authed via requireAuth() at the router
 * level. Controllers grab `req.auth.uid` and delegate to the service.
 */

export const checkout: RequestHandler = async (req, res, next) => {
  try {
    const auth = currentAuth(req);
    if (!auth) throw new AppError(401, "Unauthorized");
    const parsed = checkoutSchema.safeParse(req.body);
    if (!parsed.success) {
      throw parsed.error;
    }
    const result = await service.checkout(auth.uid, parsed.data);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const list: RequestHandler = async (req, res, next) => {
  try {
    const auth = currentAuth(req);
    if (!auth) throw new AppError(401, "Unauthorized");
    const orders = await service.listForUser(auth.uid);
    res.json(orders);
  } catch (err) {
    next(err);
  }
};

export const getOne: RequestHandler = async (req, res, next) => {
  try {
    const auth = currentAuth(req);
    if (!auth) throw new AppError(401, "Unauthorized");
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) throw new AppError(400, "BadId");
    const order = await service.findByIdForUser(auth.uid, id);
    if (!order) throw new AppError(404, "OrderNotFound");
    res.json(order);
  } catch (err) {
    next(err);
  }
};
