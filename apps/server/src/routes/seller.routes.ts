import { Router } from "express";
import * as ctrl from "../controllers/seller.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { requireStore } from "../middleware/seller.js";

/**
 * Phase 13.9 — seller resource. Read side (13.9.1) + write side
 * (13.9.2) co-exist on this router.
 *
 * Two middleware tiers:
 *   1. become-seller is the ONE endpoint that needs auth but NOT a
 *      store (the user doesn't have one yet — that's the point).
 *      Mounted FIRST, before the router.use() line.
 *   2. Everything else needs both auth + store. Single router.use()
 *      applies both gates to every route registered AFTER it.
 *
 * Route order matters for /orders/export vs /orders/:id (literal
 * wins because Express matches by mount order).
 *
 * Endpoints
 *   POST   /seller/become-seller         (auth only)
 *
 *   ── below requires auth + store ────────────────────────────
 *   GET    /seller/store
 *   PATCH  /seller/store
 *   GET    /seller/products
 *   POST   /seller/products
 *   GET    /seller/products/:id
 *   PATCH  /seller/products/:id          fast-path { isActive } OR full
 *   DELETE /seller/products/:id          soft-delete + audit
 *   POST   /seller/products/:id/duplicate clone (paused)
 *   PATCH  /seller/product-items/:id     targeted variant nudge
 *   GET    /seller/coupons
 *   POST   /seller/coupons
 *   GET    /seller/stats
 *   GET    /seller/orders/export         CSV
 *   GET    /seller/orders                ?status= filter
 *   PATCH  /seller/orders/:id            fulfilled / cancelled
 *   POST   /seller/orders/:id/refund     refund + transaction
 */
const router = Router();

// Tier 1 — become-seller needs auth ONLY (no store yet).
router.post("/become-seller", requireAuth(), ctrl.becomeSeller);

// Tier 2 — everything below requires both gates. Apply once.
router.use(requireAuth(), requireStore());

// Store
router.get("/store",                      ctrl.getStore);
router.patch("/store",                    ctrl.updateStore);

// Products
router.get("/products",                   ctrl.listProducts);
router.post("/products",                  ctrl.createProduct);
router.get("/products/:id",               ctrl.getProduct);
router.patch("/products/:id",             ctrl.updateProduct);
router.delete("/products/:id",            ctrl.deleteProduct);
router.post("/products/:id/duplicate",    ctrl.duplicateProduct);

// Product variants
router.patch("/product-items/:id",        ctrl.patchVariant);

// Coupons
router.get("/coupons",                    ctrl.listCoupons);
router.post("/coupons",                   ctrl.createCoupon);

// Stats / Orders (read)
router.get("/stats",                      ctrl.getStats);
router.get("/orders/export",              ctrl.exportOrders);
router.get("/orders",                     ctrl.listOrders);

// Orders (write)
router.patch("/orders/:id",               ctrl.updateOrderStatus);
router.post("/orders/:id/refund",         ctrl.refundOrder);

export default router;
