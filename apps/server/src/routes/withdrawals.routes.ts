import { Router } from "express";
import * as ctrl from "../controllers/withdrawal.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { requireStore } from "../middleware/seller.js";

/**
 * Phase 20.2 — withdrawal routes.
 *
 * Two routers exported:
 *   - default `sellerRouter` mounts at /seller (3 endpoints, all auth +
 *     store-gated). Sits alongside seller.routes.ts.
 *   - named `adminWithdrawalsRouter` mounts at /admin (4 endpoints, all
 *     auth + admin-role-gated at the controller level via currentAuth).
 *
 * Route order matters for /admin/withdrawals/:id vs the more specific
 * /admin/withdrawals/:id/approve|reject — Express matches by registration
 * order so the literal trailing-segment routes are registered first.
 */

const sellerRouter = Router();
sellerRouter.use(requireAuth(), requireStore());
sellerRouter.get("/wallet",        ctrl.getSellerWallet);
sellerRouter.get("/withdrawals",   ctrl.listMyWithdrawals);
sellerRouter.post("/withdrawals",  ctrl.requestWithdrawal);
export default sellerRouter;

export const adminWithdrawalsRouter = Router();
adminWithdrawalsRouter.use(requireAuth());
adminWithdrawalsRouter.post(
  "/withdrawals/:id/approve",
  ctrl.adminApproveWithdrawal,
);
adminWithdrawalsRouter.post(
  "/withdrawals/:id/reject",
  ctrl.adminRejectWithdrawal,
);
adminWithdrawalsRouter.get("/withdrawals/:id", ctrl.adminGetWithdrawal);
adminWithdrawalsRouter.get("/withdrawals",     ctrl.adminListWithdrawals);
