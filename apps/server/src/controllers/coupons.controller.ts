import type { RequestHandler } from "express";
import { validateCouponSchema } from "../models/coupons.model.js";
import * as service from "../services/coupons.service.js";
import { AppError } from "../utils/errors.js";

/**
 * POST /coupons/validate — body `{ code }`. Always returns 200 with
 * `{ valid, reason? }` so the client can surface the rejection
 * reason inline (see service for the failure ladder).
 * Validation gate ONLY rejects malformed bodies (missing / oversized
 * code) with 400; "this code doesn't exist" is a 200-with-`valid:false`
 * answer.
 */
export const validate: RequestHandler = async (req, res, next) => {
  try {
    const parsed = validateCouponSchema.safeParse(req.body);
    if (!parsed.success) {
      throw parsed.error;
    }
    const result = await service.validateCoupon(parsed.data.code);
    res.json(result);
  } catch (err) {
    next(err);
  }
};
