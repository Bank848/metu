import type { RequestHandler } from "express";
import * as service from "../services/withdrawal.service.js";
import {
  approveWithdrawalSchema,
  rejectWithdrawalSchema,
  requestWithdrawalSchema,
} from "../models/withdrawal.model.js";
import { currentAuth } from "../middleware/auth.js";
import { AppError } from "../utils/errors.js";

/** GET /seller/wallet — store balance + recent activity + pending requests. */
export const getSellerWallet: RequestHandler = async (req, res, next) => {
  try {
    const auth = currentAuth(req);
    if (!auth) throw new AppError(401, "Unauthorized");
    const data = await service.getSellerWallet(auth.uid);
    res.json(data);
  } catch (err) {
    next(err);
  }
};

/** GET /seller/withdrawals — full withdrawal history for the calling seller. */
export const listMyWithdrawals: RequestHandler = async (req, res, next) => {
  try {
    const auth = currentAuth(req);
    if (!auth) throw new AppError(401, "Unauthorized");
    const rows = await service.listMyWithdrawals(auth.uid);
    res.json({ withdrawals: rows });
  } catch (err) {
    next(err);
  }
};

/** POST /seller/withdrawals — submit a withdraw request. */
export const requestWithdrawal: RequestHandler = async (req, res, next) => {
  try {
    const auth = currentAuth(req);
    if (!auth) throw new AppError(401, "Unauthorized");
    const parsed = requestWithdrawalSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, "ValidationError", parsed.error.message);
    }
    const result = await service.requestWithdrawal(auth.uid, parsed.data, req);
    res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
};

/** GET /admin/withdrawals?status=pending|all — admin queue. */
export const adminListWithdrawals: RequestHandler = async (req, res, next) => {
  try {
    const auth = currentAuth(req);
    if (!auth) throw new AppError(401, "Unauthorized");
    if (auth.role !== "admin") throw new AppError(403, "Forbidden");
    const filter = req.query.status === "all" ? "all" : "pending";
    const rows = await service.adminListWithdrawals(filter);
    res.json({ withdrawals: rows });
  } catch (err) {
    next(err);
  }
};

/** GET /admin/withdrawals/:id — single withdrawal detail. */
export const adminGetWithdrawal: RequestHandler<{ id: string }> = async (req, res, next) => {
  try {
    const auth = currentAuth(req);
    if (!auth) throw new AppError(401, "Unauthorized");
    if (auth.role !== "admin") throw new AppError(403, "Forbidden");
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) throw new AppError(400, "BadId");
    const row = await service.adminGetWithdrawal(id);
    if (!row) throw new AppError(404, "WithdrawalNotFound");
    res.json({ withdrawal: row });
  } catch (err) {
    next(err);
  }
};

/** POST /admin/withdrawals/:id/approve — mark paid + attach slip. */
export const adminApproveWithdrawal: RequestHandler<{ id: string }> = async (req, res, next) => {
  try {
    const auth = currentAuth(req);
    if (!auth) throw new AppError(401, "Unauthorized");
    if (auth.role !== "admin") throw new AppError(403, "Forbidden");
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) throw new AppError(400, "BadId");
    const parsed = approveWithdrawalSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, "ValidationError", parsed.error.message);
    }
    await service.approveWithdrawal(auth.uid, id, parsed.data, req);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};

/** POST /admin/withdrawals/:id/reject — refund coins + capture reason. */
export const adminRejectWithdrawal: RequestHandler<{ id: string }> = async (req, res, next) => {
  try {
    const auth = currentAuth(req);
    if (!auth) throw new AppError(401, "Unauthorized");
    if (auth.role !== "admin") throw new AppError(403, "Forbidden");
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) throw new AppError(400, "BadId");
    const parsed = rejectWithdrawalSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, "ValidationError", parsed.error.message);
    }
    await service.rejectWithdrawal(auth.uid, id, parsed.data, req);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};
