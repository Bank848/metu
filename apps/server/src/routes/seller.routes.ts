import { Router } from "express";
import * as ctrl from "../controllers/seller.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { requireStore } from "../middleware/seller.js";

// /seller routes. become-seller needs auth only; everything else
// needs auth + store. /orders/export must mount before /orders/:id.
const router = Router();

router.post("/become-seller", requireAuth(), ctrl.becomeSeller);

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
