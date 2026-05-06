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
router.post("/users/:id/unban",       ctrl.unbanUser);
router.post("/users/:id/require-password-reset", ctrl.setRequirePasswordReset);

// Stores
router.get("/stores",                 ctrl.listStores);
// Specific sub-paths must register before the generic /:id GET so Express
// matches /:id/products/:pid first. Both verbs (GET / PATCH / DELETE)
// disambiguate, but keeping ordering explicit avoids surprises.
router.get("/stores/:id/products",                 ctrl.listStoreProducts);
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

// Reports
router.get("/reports/:name",          ctrl.runReport);

// Database inspector
router.get("/db/snapshot",            ctrl.dbSnapshot);
router.post("/db/run",                ctrl.dbRunSql);

export default router;
