import type { RequestHandler } from "express";
import {
  questionAnswerSchema,
  questionAskSchema,
  questionEditSchema,
} from "../models/qna.model.js";
import * as service from "../services/qna.service.js";
import { currentAuth, currentUser } from "../middleware/auth.js";
import { AppError } from "../utils/errors.js";

/**
 * GET /products/:productId/questions — public list, no auth.
 * Mounted via the productQuestionsRouter (mergeParams:true).
 */
export const list: RequestHandler<{ productId: string }> = async (
  req,
  res,
  next,
) => {
  try {
    const productId = Number(req.params.productId);
    if (!Number.isFinite(productId)) throw new AppError(400, "BadId");
    const questions = await service.listForProduct(productId);
    res.json({ questions });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /products/:productId/questions — auth-gated. Buyer asks.
 */
export const ask: RequestHandler<{ productId: string }> = async (
  req,
  res,
  next,
) => {
  try {
    const auth = currentAuth(req);
    if (!auth) throw new AppError(401, "Unauthorized");
    const productId = Number(req.params.productId);
    if (!Number.isFinite(productId)) throw new AppError(400, "BadId");
    const parsed = questionAskSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, "ValidationError", parsed.error.message);
    }
    const question = await service.askQuestion(auth.uid, productId, parsed.data);
    res.json({ ok: true, question });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /questions/:id — admin OR asker (body field), admin only
 * (answer field via this route — sellers use /questions/:id/answer
 * which stamps answeredAt + answererId properly).
 */
export const edit: RequestHandler<{ id: string }> = async (req, res, next) => {
  try {
    const auth = currentAuth(req);
    if (!auth) throw new AppError(401, "Unauthorized");
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) throw new AppError(400, "BadId");
    const parsed = questionEditSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, "ValidationError", parsed.error.message);
    }
    const updated = await service.editQuestion(
      id,
      { userId: auth.uid, isAdmin: auth.role === "admin" },
      parsed.data,
    );
    res.json({ question: updated });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /questions/:id — admin OR asker. Admin deletes write
 * `question.delete` AuditLog with snapshot.
 */
export const remove: RequestHandler<{ id: string }> = async (req, res, next) => {
  try {
    const auth = currentAuth(req);
    if (!auth) throw new AppError(401, "Unauthorized");
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) throw new AppError(400, "BadId");
    await service.deleteQuestion(id, {
      userId: auth.uid,
      isAdmin: auth.role === "admin",
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /questions/:id/answer — only the product's seller (or
 * admin) may answer. Reads the user's store from the auth-loaded
 * `req.user` to verify ownership.
 */
export const answer: RequestHandler<{ id: string }> = async (req, res, next) => {
  try {
    const auth = currentAuth(req);
    const user = currentUser(req);
    if (!auth || !user) throw new AppError(401, "Unauthorized");
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) throw new AppError(400, "BadId");
    const parsed = questionAnswerSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, "ValidationError", parsed.error.message);
    }
    const updated = await service.answerQuestion(
      id,
      {
        userId: auth.uid,
        isAdmin: auth.role === "admin",
        storeId: user.store?.storeId ?? null,
      },
      parsed.data,
    );
    res.json({ ok: true, question: updated });
  } catch (err) {
    next(err);
  }
};
