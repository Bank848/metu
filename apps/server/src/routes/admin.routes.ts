import { Router } from "express";
import * as ctrl from "../controllers/admin.controller.js";
import { requireAuth } from "../middleware/auth.js";

// Admin resource. requireAuth(["admin"]) at the router level.
const router = Router();

router.use(requireAuth(["admin"]));

// Users
router.get("/users",                  ctrl.listUsers);
router.patch("/users/:id",            ctrl.updateUserRole);
router.delete("/users/:id",           ctrl.deleteUser);
router.post("/users/:id/require-password-reset", ctrl.setRequirePasswordReset);

// Stores
router.get("/stores",                 ctrl.listStores);
router.delete("/stores/:id",          ctrl.deleteStore);
// Reversible "freeze" alternative to DELETE. Body: { value: boolean }.
router.post("/stores/:id/suspend",    ctrl.setStoreSuspended);

// Stats
router.get("/stats",                  ctrl.getStats);

// Transactions
router.delete("/transactions/:id",    ctrl.deleteTransaction);
router.post("/transactions/:id/refund", ctrl.refundTransaction);

// Reports
router.get("/reports/:name",          ctrl.runReport);

export default router;
