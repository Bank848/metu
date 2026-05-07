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
import { couponInputSchema } from "@metu/shared";

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

export const getStats: RequestHandler = async (req, res, next) => {
  try {
    // ?days= drives the daily revenue series window. Default 14 to
    // keep the legacy chart unchanged when no param is sent.
    const days = Number(req.query.days);
    const stats = await service.getStats(Number.isFinite(days) ? days : 14);
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

/** GET /admin/dashboard/heatmap?days=30 — 7×24 order activity grid. */
export const getOrderHeatmap: RequestHandler = async (req, res, next) => {
  try {
    const days = Number(req.query.days ?? 30);
    const grid = await service.getOrderHeatmap(Number.isFinite(days) ? days : 30);
    res.json(grid.map((r) => ({ dow: r.dow, hour: r.hour, orders: Number(r.orders) })));
  } catch (err) {
    next(err);
  }
};

/** POST /admin/dashboard/refresh-matview — manual top-stores refresh. */
export const refreshTopStoresMatview: RequestHandler = async (req, res, next) => {
  try {
    const auth = currentAuth(req)!;
    await service.refreshTopStoresMatview(auth.uid, req);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};

export const createMasterCoupon: RequestHandler = async (req, res, next) => {
  try {
    const auth = currentAuth(req)!;
    // Validate via the shared couponInputSchema — already enforces:
    //   - code: 3-50 chars, uppercase alphanumeric
    //   - discountType: "percent" | "fixed"
    //   - percent ≤ 100 (refine)
    //   - startDate / endDate: ISO datetime
    //   - endDate >= startDate (refine)
    //   - usageLimit: positive int
    // Earlier rev did ad-hoc Number()/String() coercion + new Date()
    // in the service — bad input ("asdf" for startDate) fell through
    // to Prisma which crashed with a 500 leaking schema info. Zod
    // turns those into a clean 400 ValidationError.
    const parsed = couponInputSchema.safeParse(req.body);
    if (!parsed.success) {
      throw parsed.error;
    }
    // Force the code to uppercase. Schema already enforces uppercase
    // alphanumeric so this is just defence-in-depth in case the
    // refine accepts mixed case in the future.
    const code = parsed.data.code.toUpperCase();
    const created = await service.createMasterCoupon({
      ...parsed.data,
      code,
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

/** GET /admin/stores/:id — full detail for the admin store page. */
export const getStoreDetail: RequestHandler<{ id: string }> = async (req, res, next) => {
  try {
    const storeId = Number(req.params.id);
    if (!Number.isFinite(storeId)) throw new AppError(400, "BadId");
    const store = await service.getStoreDetail(storeId);
    res.json(store);
  } catch (err) {
    next(err);
  }
};

/** PATCH /admin/stores/:id — admin-side store edit. */
export const updateStore: RequestHandler<{ id: string }> = async (req, res, next) => {
  try {
    const auth = currentAuth(req)!;
    const storeId = Number(req.params.id);
    if (!Number.isFinite(storeId)) throw new AppError(400, "BadId");
    const result = await service.adminUpdateStore(storeId, auth.uid, req.body ?? {}, req);
    res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
};

/** GET /admin/stores/:id/products — list every product under a store. */
export const listStoreProducts: RequestHandler<{ id: string }> = async (req, res, next) => {
  try {
    const storeId = Number(req.params.id);
    if (!Number.isFinite(storeId)) throw new AppError(400, "BadId");
    const products = await service.listStoreProducts(storeId);
    res.json(products);
  } catch (err) {
    next(err);
  }
};

/** GET /admin/stores/:id/products/:pid — single product detail (admin scope). */
export const getStoreProduct: RequestHandler<{ id: string; pid: string }> = async (req, res, next) => {
  try {
    const storeId = Number(req.params.id);
    const productId = Number(req.params.pid);
    if (!Number.isFinite(storeId) || !Number.isFinite(productId)) throw new AppError(400, "BadId");
    const product = await service.getStoreProduct(productId, storeId);
    res.json(product);
  } catch (err) {
    next(err);
  }
};

/** PATCH /admin/stores/:id/products/:pid — admin-side product edit. */
export const updateStoreProduct: RequestHandler<{ id: string; pid: string }> = async (req, res, next) => {
  try {
    const auth = currentAuth(req)!;
    const storeId = Number(req.params.id);
    const productId = Number(req.params.pid);
    if (!Number.isFinite(storeId) || !Number.isFinite(productId)) throw new AppError(400, "BadId");
    const result = await service.adminUpdateProduct(productId, storeId, auth.uid, req.body ?? {}, req);
    res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
};

/** DELETE /admin/stores/:id/products/:pid — admin-side hard-delete. */
export const deleteStoreProduct: RequestHandler<{ id: string; pid: string }> = async (req, res, next) => {
  try {
    const auth = currentAuth(req)!;
    const storeId = Number(req.params.id);
    const productId = Number(req.params.pid);
    if (!Number.isFinite(storeId) || !Number.isFinite(productId)) throw new AppError(400, "BadId");
    await service.adminDeleteProduct(productId, storeId, auth.uid, req);
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
