import type { RequestHandler } from "express";
import {
  adminGrantSchema,
  rejectTopupSchema,
  requestTopupSchema,
  submitSlipSchema,
} from "../models/wallet.model.js";
import * as service from "../services/wallet.service.js";
import { currentAuth } from "../middleware/auth.js";
import { AppError } from "../utils/errors.js";

/**
 * Phase 17.1 — wallet controller.
 *
 * GET  /wallet            — current user's balance + flag
 * GET  /wallet/transactions — current user's recent ledger
 * POST /admin/users/:id/grant-coins — admin grant (auth + admin role)
 *
 * Top-up endpoints (POST /wallet/topup, etc.) ship in Phase 17.3.
 */

export const getMyBalance: RequestHandler = async (req, res, next) => {
  try {
    const auth = currentAuth(req);
    if (!auth) throw new AppError(401, "Unauthorized");
    const result = await service.getBalance(auth.uid);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const getMyTransactions: RequestHandler = async (req, res, next) => {
  try {
    const auth = currentAuth(req);
    if (!auth) throw new AppError(401, "Unauthorized");
    const limit = Number(req.query.limit ?? 50);
    const result = await service.listTransactions(auth.uid, Number.isFinite(limit) ? limit : 50);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /admin/users/:id/grant-coins — admin-only.
 *
 * Body: { amount: number, reason: string }
 * Audits as `admin.wallet.grant` so the trail captures who granted
 * how much to whom + why.
 */
export const adminGrant: RequestHandler<{ id: string }> = async (req, res, next) => {
  try {
    const auth = currentAuth(req);
    if (!auth) throw new AppError(401, "Unauthorized");
    const targetId = Number(req.params.id);
    if (!Number.isFinite(targetId)) throw new AppError(400, "BadId");
    const parsed = adminGrantSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, "ValidationError", parsed.error.message);
    }
    const result = await service.adminGrant(auth.uid, targetId, parsed.data, req);
    res.json({ ok: true, balanceAfter: result.balanceAfter });
  } catch (err) {
    next(err);
  }
};

// =============================================================================
//  Phase 17.3 — top-up flow
// =============================================================================

/** POST /wallet/topup — start a top-up + receive QR payload. */
export const requestTopup: RequestHandler = async (req, res, next) => {
  try {
    const auth = currentAuth(req);
    if (!auth) throw new AppError(401, "Unauthorized");
    const parsed = requestTopupSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, "ValidationError", parsed.error.message);
    }
    const result = await service.requestTopup(auth.uid, parsed.data);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /wallet/topup/:id/slip — submit a payment slip image.
 * Returns { status, autoApproved, balanceAfter? }; slip-QR auto-verify
 * runs server-side via the promptpay util. Failed verifications
 * stash the image for admin review (status stays "pending").
 */
export const submitSlip: RequestHandler<{ id: string }> = async (req, res, next) => {
  try {
    const auth = currentAuth(req);
    if (!auth) throw new AppError(401, "Unauthorized");
    const topupId = Number(req.params.id);
    if (!Number.isFinite(topupId)) throw new AppError(400, "BadId");
    const parsed = submitSlipSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, "ValidationError", parsed.error.message);
    }
    const result = await service.submitSlip(auth.uid, topupId, parsed.data, req);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

/** GET /admin/topups — pending review queue (admin-only). */
export const adminListTopups: RequestHandler = async (req, res, next) => {
  try {
    const auth = currentAuth(req);
    if (!auth) throw new AppError(401, "Unauthorized");
    const status = req.query.status === "all" ? "all" : "pending";
    const rows = await service.listTopupsForAdmin(status);
    res.json({ topups: rows });
  } catch (err) {
    next(err);
  }
};

/** POST /admin/topups/:id/approve — manual approval. */
export const adminApproveTopup: RequestHandler<{ id: string }> = async (req, res, next) => {
  try {
    const auth = currentAuth(req);
    if (!auth) throw new AppError(401, "Unauthorized");
    const topupId = Number(req.params.id);
    if (!Number.isFinite(topupId)) throw new AppError(400, "BadId");
    const result = await service.approveTopup(auth.uid, topupId, req);
    res.json({ ok: true, balanceAfter: result.balanceAfter });
  } catch (err) {
    next(err);
  }
};

/** POST /admin/topups/:id/reject — admin rejection with reason. */
export const adminRejectTopup: RequestHandler<{ id: string }> = async (req, res, next) => {
  try {
    const auth = currentAuth(req);
    if (!auth) throw new AppError(401, "Unauthorized");
    const topupId = Number(req.params.id);
    if (!Number.isFinite(topupId)) throw new AppError(400, "BadId");
    const parsed = rejectTopupSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, "ValidationError", parsed.error.message);
    }
    await service.rejectTopup(auth.uid, topupId, parsed.data.reason, req);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};
