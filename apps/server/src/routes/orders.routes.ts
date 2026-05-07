import { Router } from "express";
import * as ctrl from "../controllers/orders.controller.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// Every endpoint authed — apply once at the router level.
router.use(requireAuth());

router.post("/",          ctrl.checkout);     // POST /orders → place order
router.get("/",           ctrl.list);         // GET  /orders → user's order history
router.get("/:id",        ctrl.getOne);       // GET  /orders/:id → receipt
router.post("/:id/retry", ctrl.retryPayment); // POST /orders/:id/retry → fresh PI for pending order
router.post("/:id/sync",  ctrl.syncMyOrder);  // POST /orders/:id/sync  → owner-scoped Stripe re-fetch

export default router;
