import { Router } from "express";
import * as ctrl from "../controllers/admin.controller.js";
import { requireAuth } from "../middleware/auth.js";

/**
 * Phase 13.10 — admin resource. Single role gate at the router
 * level — every endpoint requires `role === 'admin'`. The existing
 * requireAuth(["admin"]) returns 401 (no cookie) or 403 (logged in
 * but not admin), so handlers can assume admin context.
 *
 * Endpoints (all auth + role-gated):
 *   GET    /admin/users                   list with q/role/page filters
 *   PATCH  /admin/users/:id               role change (self-demote 400)
 *   DELETE /admin/users/:id               soft-delete (with optional reason → ban)
 *
 *   GET    /admin/stores                  live stores only (deletedAt:null)
 *   DELETE /admin/stores/:id              soft-delete + audit
 *
 *   GET    /admin/stats                   composite KPI dashboard payload
 *
 *   DELETE /admin/transactions/:id        hard-delete + snapshot audit
 *   POST   /admin/transactions/:id/refund refund + insert refund tx
 *
 *   GET    /admin/reports/:name           5 named raw-SQL reports
 */
const router = Router();

router.use(requireAuth(["admin"]));

// Users
router.get("/users",                  ctrl.listUsers);
router.patch("/users/:id",            ctrl.updateUserRole);
router.delete("/users/:id",           ctrl.deleteUser);
// Phase 15.5 — admin force-password-reset toggle.
router.post("/users/:id/require-password-reset", ctrl.setRequirePasswordReset);

// Stores
router.get("/stores",                 ctrl.listStores);
router.delete("/stores/:id",          ctrl.deleteStore);
// Phase 16.1 — reversible "freeze" alternative to DELETE.
// Body: { value: boolean }.
router.post("/stores/:id/suspend",    ctrl.setStoreSuspended);

// Stats
router.get("/stats",                  ctrl.getStats);

// Transactions
router.delete("/transactions/:id",    ctrl.deleteTransaction);
router.post("/transactions/:id/refund", ctrl.refundTransaction);

// Reports
router.get("/reports/:name",          ctrl.runReport);

export default router;
