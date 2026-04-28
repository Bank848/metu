import { Router } from "express";
import * as ctrl from "../controllers/seller.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { requireStore } from "../middleware/seller.js";

/**
 * Phase 13.9.1 — seller resource (read side).
 *
 * Every endpoint requires (a) a logged-in user and (b) ownership of
 * a Store row. requireAuth() loads req.user with the store relation,
 * then requireStore() returns 403 NoStore if the user hasn't
 * onboarded.
 *
 *   GET /seller/store              — current store (with stats + bizType)
 *   GET /seller/products           — own products (live, soft-deleted hidden)
 *   GET /seller/products/:id       — single product, full edit-form payload
 *   GET /seller/stats              — analytics dashboard data
 *   GET /seller/orders?status=     — orders containing seller's lines
 *   GET /seller/orders/export      — CSV download
 *
 * Mount at /seller in app.ts.
 *
 * `/orders/export` is declared BEFORE `/orders` so the literal path
 * always wins the route match (Express matches by registration order
 * within the router; static segments would normally trump dynamic
 * but `:id` here doesn't even exist, so listing /export first is
 * just defensive).
 */
const router = Router();

// Apply both gates once, at the router level — every read endpoint
// needs them, and stacking them per-route would be noise.
router.use(requireAuth(), requireStore());

router.get("/store",          ctrl.getStore);
router.get("/products",       ctrl.listProducts);
router.get("/products/:id",   ctrl.getProduct);
router.get("/stats",          ctrl.getStats);
router.get("/orders/export",  ctrl.exportOrders);
router.get("/orders",         ctrl.listOrders);

export default router;
