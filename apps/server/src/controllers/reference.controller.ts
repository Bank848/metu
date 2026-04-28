import type { RequestHandler } from "express";
import * as service from "../services/reference.service.js";

/** GET /business-types — list of seller business categories. */
export const businessTypes: RequestHandler = async (_req, res, next) => {
  try {
    const data = await service.listBusinessTypes();
    res.json(data);
  } catch (err) {
    next(err);
  }
};

/** GET /countries — list of countries for the register form. */
export const countries: RequestHandler = async (_req, res, next) => {
  try {
    const data = await service.listCountries();
    res.json(data);
  } catch (err) {
    next(err);
  }
};
