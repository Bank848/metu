import type { RequestHandler } from "express";
import { listQuerySchema } from "../models/stores.model.js";
import * as service from "../services/stores.service.js";
import { AppError } from "../utils/errors.js";

export const list: RequestHandler = async (req, res, next) => {
  try {
    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw parsed.error;
    }
    const stores = await service.findStores(parsed.data);
    res.json(stores);
  } catch (err) {
    next(err);
  }
};

export const getOne: RequestHandler = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) throw new AppError(400, "BadId");
    const store = await service.findStoreById(id);
    if (!store) throw new AppError(404, "StoreNotFound");
    res.json(store);
  } catch (err) {
    next(err);
  }
};
