import { Router } from "express";
import * as ctrl from "../controllers/withdrawal.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { requireStore } from "../middleware/seller.js";
import { submitWithdrawLimiter } from "../middleware/rate-limit.js";
import { requireRecent2FA } from "../middleware/require-recent-2fa.js";

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
// Phase 22 — POST is rate-limited to 3/hr/user so a stolen session
// can't fire a barrage of withdrawal requests with attacker-controlled
// bank details.
// Phase 23.3 — requireRecent2FA(15) gates withdrawals on a fresh TOTP
// step-up (15 min window). Users without TOTP enrolled fall through
// the middleware. With TOTP on, even a stolen session needs the
// authenticator app to drain the seller's balance.
sellerRouter.post(
  "/withdrawals",
  submitWithdrawLimiter,
  requireRecent2FA(15),
  ctrl.requestWithdrawal,
);
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
