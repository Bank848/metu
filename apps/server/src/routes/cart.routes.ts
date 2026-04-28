import { Router } from "express";
import * as ctrl from "../controllers/cart.controller.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// Every cart endpoint is authed — apply once at the router level
// instead of decorating each route.
router.use(requireAuth());

router.get("/",            ctrl.get);          // GET /cart
router.post("/items",      ctrl.addItem);      // POST /cart/items
router.patch("/items/:id", ctrl.updateItem);   // PATCH /cart/items/:id
router.delete("/items/:id", ctrl.removeItem);  // DELETE /cart/items/:id

export default router;
