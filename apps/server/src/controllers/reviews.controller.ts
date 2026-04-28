import type { RequestHandler } from "express";
import { reviewEditSchema, reviewInputSchema } from "../models/reviews.model.js";
import * as service from "../services/reviews.service.js";
import { currentAuth } from "../middleware/auth.js";
import { AppError } from "../utils/errors.js";

/**
 * POST /products/:productId/reviews — create. Mounted via the
 * productReviewsRouter exported from `routes/reviews.routes.ts`.
 * `req.params.productId` is available because that router is
 * created with `mergeParams: true`.
 */
export const create: RequestHandler<{ productId: string }> = async (
  req,
  res,
  next,
) => {
  try {
    const auth = currentAuth(req);
    if (!auth) throw new AppError(401, "Unauthorized");
    const productId = Number(req.params.productId);
    if (!Number.isFinite(productId)) throw new AppError(400, "BadId");
    const parsed = reviewInputSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, "ValidationError", parsed.error.message);
    }
    const review = await service.createReview(auth.uid, productId, parsed.data);
    res.json({ review });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /reviews/:id — admin OR author can edit. Sellers can NOT
 * edit reviews on their own products even though they're "involved"
 * — that's exactly the manipulation the moderation layer prevents.
 */
export const update: RequestHandler<{ id: string }> = async (req, res, next) => {
  try {
    const auth = currentAuth(req);
    if (!auth) throw new AppError(401, "Unauthorized");
    const reviewId = Number(req.params.id);
    if (!Number.isFinite(reviewId)) throw new AppError(400, "BadId");
    const parsed = reviewEditSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, "ValidationError", parsed.error.message);
    }
    const updated = await service.updateReview(
      reviewId,
      { userId: auth.uid, isAdmin: auth.role === "admin" },
      parsed.data,
    );
    res.json({ review: updated });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /reviews/:id — same admin-OR-author gate as update. Hard
 * delete; AuditLog snapshot is the only forensic record after.
 */
export const remove: RequestHandler<{ id: string }> = async (req, res, next) => {
  try {
    const auth = currentAuth(req);
    if (!auth) throw new AppError(401, "Unauthorized");
    const reviewId = Number(req.params.id);
    if (!Number.isFinite(reviewId)) throw new AppError(400, "BadId");
    await service.deleteReview(reviewId, {
      userId: auth.uid,
      isAdmin: auth.role === "admin",
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};
