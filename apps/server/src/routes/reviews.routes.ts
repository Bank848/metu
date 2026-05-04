import { Router } from "express";
import * as ctrl from "../controllers/reviews.controller.js";
import { requireAuth } from "../middleware/auth.js";

/**
 * Reviews has two URL families:
 *   • POST /products/:productId/reviews — create (path-parented to
 *     the product so the productId comes from the URL, not the body)
 *   • PATCH/DELETE /reviews/:id          — modify (id is sufficient
 *     since reviews are globally-unique)
 * Both share the same controller + service, so we ship two routers
 * from this one file rather than splitting the resource into two
 * files. app.ts mounts each at its respective prefix.
 */

// PATCH/DELETE /reviews/:id — default export, mounted at /reviews
const router = Router();
router.use(requireAuth());
router.patch("/:id",  ctrl.update);
router.delete("/:id", ctrl.remove);
export default router;

// POST /products/:productId/reviews — mounted at
// /products/:productId/reviews. mergeParams:true is required so
// `req.params.productId` resolves inside the controller.
export const productReviewsRouter = Router({ mergeParams: true });
productReviewsRouter.use(requireAuth());
productReviewsRouter.post("/", ctrl.create);
