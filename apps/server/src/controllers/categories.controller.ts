import type { RequestHandler } from "express";
import * as service from "../services/categories.service.js";

export const list: RequestHandler = async (_req, res, next) => {
  try {
    res.json(await service.findCategories());
  } catch (err) {
    next(err);
  }
};
