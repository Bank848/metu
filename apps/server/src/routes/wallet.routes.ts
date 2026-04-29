import { Router } from "express";
import * as ctrl from "../controllers/wallet.controller.js";
import { requireAuth } from "../middleware/auth.js";

/**
 * Phase 17.1 — wallet router.
 *
 *   GET /wallet              — current user's balance + walletEnabled flag
 *   GET /wallet/transactions — recent ledger
 *
 * Top-up endpoints land in Phase 17.3 (POST /wallet/topup, ...).
 * Admin grant lives under /admin/users/:id/grant-coins (mounted by
 * the admin router file).
 */
const router = Router();
router.get("/",                requireAuth(), ctrl.getMyBalance);
router.get("/transactions",    requireAuth(), ctrl.getMyTransactions);
// Phase 17.3 — top-up flow.
router.post("/topup",          requireAuth(), ctrl.requestTopup);
router.post("/topup/:id/slip", requireAuth(), ctrl.submitSlip);
export default router;

export const adminWalletRouter = Router();
// POST /admin/users/:id/grant-coins
adminWalletRouter.post(
  "/users/:id/grant-coins",
  requireAuth(["admin"]),
  ctrl.adminGrant,
);
// Phase 17.3 — admin top-up review queue.
adminWalletRouter.get(
  "/topups",
  requireAuth(["admin"]),
  ctrl.adminListTopups,
);
adminWalletRouter.post(
  "/topups/:id/approve",
  requireAuth(["admin"]),
  ctrl.adminApproveTopup,
);
adminWalletRouter.post(
  "/topups/:id/reject",
  requireAuth(["admin"]),
  ctrl.adminRejectTopup,
);
