import type { RequestHandler } from "express";
import * as service from "../services/admin.service.js";
import { currentAuth } from "../middleware/auth.js";
import { AppError } from "../utils/errors.js";
import {
  userListQuerySchema,
  updateUserRoleSchema,
  deleteUserSchema,
  REPORT_NAMES,
  type ReportName,
} from "../models/admin.model.js";

// Admin controllers. requireAuth(["admin"]) is applied at the router level.

// ── Users ───────────────────────────────────────────────────────────

export const listUsers: RequestHandler = async (req, res, next) => {
  try {
    const parsed = userListQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw parsed.error;
    }
    const result = await service.listUsers(parsed.data);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const updateUserRole: RequestHandler<{ id: string }> = async (req, res, next) => {
  try {
    const auth = currentAuth(req)!;
    const targetUserId = Number(req.params.id);
    if (!Number.isFinite(targetUserId)) throw new AppError(400, "BadId");
    const parsed = updateUserRoleSchema.safeParse(req.body);
    if (!parsed.success) {
      throw parsed.error;
    }
    // Pass req so the audit row captures IP + UA.
    await service.updateUserRole(targetUserId, auth.uid, parsed.data, req);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};

export const deleteUser: RequestHandler<{ id: string }> = async (req, res, next) => {
  try {
    const auth = currentAuth(req)!;
    const targetUserId = Number(req.params.id);
    if (!Number.isFinite(targetUserId)) throw new AppError(400, "BadId");
    // Body optional: empty = soft-delete; with reason = ban.
    const parsed = deleteUserSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      throw parsed.error;
    }
    await service.deleteUser(targetUserId, auth.uid, parsed.data, req);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};

// clears bannedAt + bannedReason so the user can sign in again.
export const unbanUser: RequestHandler<{ id: string }> = async (req, res, next) => {
  try {
    const auth = currentAuth(req)!;
    const targetUserId = Number(req.params.id);
    if (!Number.isFinite(targetUserId)) throw new AppError(400, "BadId");
    await service.unbanUser(targetUserId, auth.uid, req);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};

// ── Stores ──────────────────────────────────────────────────────────

export const listStores: RequestHandler = async (_req, res, next) => {
  try {
    const stores = await service.listStores();
    res.json(stores);
  } catch (err) {
    next(err);
  }
};

export const deleteStore: RequestHandler<{ id: string }> = async (req, res, next) => {
  try {
    const auth = currentAuth(req)!;
    const storeId = Number(req.params.id);
    if (!Number.isFinite(storeId)) throw new AppError(400, "BadId");
    await service.deleteStore(storeId, auth.uid, req);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};

// ── Stats ───────────────────────────────────────────────────────────

export const getStats: RequestHandler = async (_req, res, next) => {
  try {
    const stats = await service.getStats();
    res.json(stats);
  } catch (err) {
    next(err);
  }
};

// Admin Dashboard Requirements §5 — full analytics roll-up.
export const getDashboard: RequestHandler = async (_req, res, next) => {
  try {
    const metrics = await service.getDashboardMetrics();
    res.json(metrics);
  } catch (err) {
    next(err);
  }
};

export const createMasterCoupon: RequestHandler = async (req, res, next) => {
  try {
    const auth = currentAuth(req)!;
    const body = req.body ?? {};
    const code = String(body.code ?? "").trim();
    const discountType = body.discountType === "percent" || body.discountType === "fixed"
      ? body.discountType
      : null;
    const discountValue = Number(body.discountValue);
    const startDate = String(body.startDate ?? "");
    const endDate = String(body.endDate ?? "");
    const usageLimit = Number(body.usageLimit);
    if (!code || !discountType || !Number.isFinite(discountValue) || discountValue <= 0
        || !startDate || !endDate || !Number.isFinite(usageLimit) || usageLimit < 1) {
      throw new AppError(400, "InvalidCouponInput", "All coupon fields are required.");
    }
    if (discountType === "percent" && (discountValue < 1 || discountValue > 100)) {
      throw new AppError(400, "InvalidPercent", "Percent discount must be 1-100.");
    }
    const created = await service.createMasterCoupon({
      code, discountType, discountValue, startDate, endDate, usageLimit,
    }, auth.uid, req);
    res.json({ ok: true, couponId: created.couponId });
  } catch (err) {
    next(err);
  }
};

// ── Transactions ────────────────────────────────────────────────────

export const deleteTransaction: RequestHandler<{ id: string }> = async (req, res, next) => {
  try {
    const auth = currentAuth(req)!;
    const transactionId = Number(req.params.id);
    if (!Number.isFinite(transactionId)) throw new AppError(400, "BadId");
    await service.deleteTransaction(transactionId, auth.uid, req);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};

export const refundTransaction: RequestHandler<{ id: string }> = async (req, res, next) => {
  try {
    const auth = currentAuth(req)!;
    const transactionId = Number(req.params.id);
    if (!Number.isFinite(transactionId)) throw new AppError(400, "BadId");
    await service.refundTransaction(transactionId, auth.uid, req);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};

/** POST /admin/stores/:id/suspend. Body: { value: boolean }. Reversible. */
export const setStoreSuspended: RequestHandler<{ id: string }> = async (req, res, next) => {
  try {
    const auth = currentAuth(req)!;
    const storeId = Number(req.params.id);
    if (!Number.isFinite(storeId)) throw new AppError(400, "BadId");
    const value = req.body?.value;
    if (typeof value !== "boolean") {
      throw new AppError(400, "ValidationError", "Send `value` as true or false.");
    }
    await service.setStoreSuspended(storeId, auth.uid, value, req);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};

/** POST /admin/users/:id/require-password-reset. Self-toggle forbidden. */
export const setRequirePasswordReset: RequestHandler<{ id: string }> = async (req, res, next) => {
  try {
    const auth = currentAuth(req)!;
    const targetUserId = Number(req.params.id);
    if (!Number.isFinite(targetUserId)) throw new AppError(400, "BadId");
    const value = req.body?.value;
    if (typeof value !== "boolean") {
      throw new AppError(400, "ValidationError", "Send `value` as true or false.");
    }
    await service.setRequirePasswordReset(targetUserId, auth.uid, value, req);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};

// ── Reports ─────────────────────────────────────────────────────────

export const runReport: RequestHandler<{ name: string }> = async (req, res, next) => {
  try {
    const name = req.params.name;
    if (!REPORT_NAMES.includes(name as ReportName)) {
      throw new AppError(404, "UnknownReport");
    }
    const result = await service.runReport(name as ReportName);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

// ── Database inspector ──────────────────────────────────────────────

export const dbSnapshot: RequestHandler = async (_req, res, next) => {
  try {
    const snapshot = await service.getDatabaseSnapshot();
    res.json(snapshot);
  } catch (err) {
    next(err);
  }
};

export const dbRunSql: RequestHandler = async (req, res, next) => {
  try {
    const sql = String(req.body?.sql ?? "");
    const result = await service.runAdminSql(sql);
    res.json(result);
  } catch (err) {
    next(err);
  }
};
