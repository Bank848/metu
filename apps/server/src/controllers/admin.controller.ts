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

/**
 * Phase 13.10 — admin controllers. The router applies
 * `requireAuth(["admin"])` once, so every handler can assume the
 * caller is an admin and currentAuth() is non-null.
 */

// ── Users ───────────────────────────────────────────────────────────

export const listUsers: RequestHandler = async (req, res, next) => {
  try {
    const parsed = userListQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new AppError(400, "ValidationError", parsed.error.message);
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
      throw new AppError(400, "ValidationError", parsed.error.message);
    }
    await service.updateUserRole(targetUserId, auth.uid, parsed.data);
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
    // Body is optional — DELETE with no body is the silent self-delete-
    // equivalent path; with a `reason` it's a ban.
    const parsed = deleteUserSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      throw new AppError(400, "ValidationError", parsed.error.message);
    }
    await service.deleteUser(targetUserId, auth.uid, parsed.data);
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
    await service.deleteStore(storeId, auth.uid);
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

// ── Transactions ────────────────────────────────────────────────────

export const deleteTransaction: RequestHandler<{ id: string }> = async (req, res, next) => {
  try {
    const auth = currentAuth(req)!;
    const transactionId = Number(req.params.id);
    if (!Number.isFinite(transactionId)) throw new AppError(400, "BadId");
    await service.deleteTransaction(transactionId, auth.uid);
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
    await service.refundTransaction(transactionId, auth.uid);
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
