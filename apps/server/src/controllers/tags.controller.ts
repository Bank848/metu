import type { RequestHandler } from "express";
import * as service from "../services/tags.service.js";

export const list: RequestHandler = async (_req, res, next) => {
  try {
    res.json(await service.findTags());
  } catch (err) {
    next(err);
  }
};
