import { Router } from "express";
import * as ctrl from "../controllers/admin.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRecent2FA } from "../middleware/require-recent-2fa.js";

// Admin resource. requireAuth(["admin"]) at the router level.
const router = Router();

router.use(requireAuth(["admin"]));

// Users
router.get("/users",                  ctrl.listUsers);
router.patch("/users/:id",            ctrl.updateUserRole);
router.delete("/users/:id",           ctrl.deleteUser);
router.post("/users/:id/unban",       ctrl.unbanUser);
router.post("/users/:id/require-password-reset", ctrl.setRequirePasswordReset);

// Stores
router.get("/stores",                 ctrl.listStores);
// Sub-paths register before /:id so /:id/products/:pid matches first.
router.get("/stores/:id/products",                 ctrl.listStoreProducts);
router.post("/stores/:id/products",                ctrl.createStoreProduct);
router.get("/stores/:id/products/:pid",            ctrl.getStoreProduct);
router.patch("/stores/:id/products/:pid",          ctrl.updateStoreProduct);
router.delete("/stores/:id/products/:pid",         ctrl.deleteStoreProduct);
router.get("/stores/:id",             ctrl.getStoreDetail);
router.patch("/stores/:id",           ctrl.updateStore);
router.delete("/stores/:id",          ctrl.deleteStore);
// Reversible "freeze" alternative to DELETE. Body: { value: boolean }.
router.post("/stores/:id/suspend",    ctrl.setStoreSuspended);

// Stats
router.get("/stats",                  ctrl.getStats);
router.get("/dashboard",              ctrl.getDashboard);
// Heatmap + manual matview refresh — same /dashboard family.
router.get("/dashboard/heatmap",      ctrl.getOrderHeatmap);
router.post("/dashboard/refresh-matview", ctrl.refreshTopStoresMatview);

// Master coupons (platform-wide).
router.post("/coupons",               ctrl.createMasterCoupon);

// Transactions
router.delete("/transactions/:id",    ctrl.deleteTransaction);
router.post("/transactions/:id/refund", ctrl.refundTransaction);

// Re-fetch a Stripe PI + replay the success handler when the webhook missed.
router.post("/orders/:id/sync-from-stripe", ctrl.syncOrderFromStripe);

// Reports
router.get("/reports/:name",          ctrl.runReport);

// Database inspector — read-only surfaces (snapshot returns schema /
// migration / index metadata; dbRunSql gates input to SELECT / WITH /
// EXPLAIN with a 200-row cap and a 30s statement timeout). Admin role
// check at the router level (requireAuth(["admin"])) plus per-call
// audit logging is the security boundary; no fresh 2FA needed.
router.get("/db/snapshot", ctrl.dbSnapshot);
router.post("/db/run",     ctrl.dbRunSql);

export default router;
