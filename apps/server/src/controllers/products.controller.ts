import type { RequestHandler } from "express";
import { browseQuerySchema } from "../models/products.model.js";
import * as service from "../services/products.service.js";
import { AppError } from "../utils/errors.js";

/**
 * GET /products — paginated browse with filter + sort. Validation
 * happens here (zod parses query string); shaping + Prisma live in
 * the service.
 */
export const browse: RequestHandler = async (req, res, next) => {
  try {
    const parsed = browseQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new AppError(400, "ValidationError", parsed.error.message);
    }
    const result = await service.findProducts(parsed.data);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /products/featured — homepage helper, hardcoded top-8 by
 * rating. No filters / pagination by design.
 */
export const featured: RequestHandler = async (_req, res, next) => {
  try {
    const items = await service.findFeatured(8);
    res.json(items);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /products/:id — full product detail. 400 on non-numeric id,
 * 404 when no row matches.
 */
export const getOne: RequestHandler = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) throw new AppError(400, "BadId", "id must be numeric");
    const product = await service.findProductById(id);
    if (!product) throw new AppError(404, "ProductNotFound");
    res.json(product);
  } catch (err) {
    next(err);
  }
};
