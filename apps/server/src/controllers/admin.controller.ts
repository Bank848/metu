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

// IP ban admin surface. Lazy-imported so the heavier
// banned-ip.service module (with its in-memory cache) only loads
// when an admin actually opens the page.
export const listBannedIps: RequestHandler = async (_req, res, next) => {
  try {
    const { listBans } = await import("../services/banned-ip.service.js");
    const rows = await listBans();
    res.json({ items: rows });
  } catch (err) {
    next(err);
  }
};

export const addBannedIp: RequestHandler = async (req, res, next) => {
  try {
    const auth = currentAuth(req)!;
    const { addBan } = await import("../services/banned-ip.service.js");
    const row = await addBan(req.body ?? {}, auth.uid, req);
    res.json({ ok: true, row });
  } catch (err) {
    next(err);
  }
};

export const removeBannedIp: RequestHandler<{ id: string }> = async (req, res, next) => {
  try {
    const auth = currentAuth(req)!;
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) throw new AppError(400, "BadId");
    const { removeBan } = await import("../services/banned-ip.service.js");
    await removeBan(id, auth.uid, req);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};

export const banUserIps: RequestHandler<{ id: string }> = async (req, res, next) => {
  try {
    const auth = currentAuth(req)!;
    const targetUserId = Number(req.params.id);
    if (!Number.isFinite(targetUserId)) throw new AppError(400, "BadId");
    const reason = String((req.body ?? {}).reason ?? "").trim() || null;
    const { banUserSessions } = await import("../services/banned-ip.service.js");
    const result = await banUserSessions(targetUserId, auth.uid, reason, req);
    res.json({ ok: true, ...result });
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
      throw new AppError(400, "ValidationError", "Body must be { value: boolean }");
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
      throw new AppError(400, "ValidationError", "Body must be { value: boolean }");
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
