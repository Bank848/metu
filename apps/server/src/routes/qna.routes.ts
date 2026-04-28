import { Router } from "express";
import * as ctrl from "../controllers/qna.controller.js";
import { requireAuth } from "../middleware/auth.js";

/**
 * Q&A has two URL families (same shape as reviews):
 *   • GET  /products/:productId/questions  — public list
 *   • POST /products/:productId/questions  — auth-gated ask
 *   • PATCH  /questions/:id                — admin/asker edit
 *   • DELETE /questions/:id                — admin/asker delete
 *   • PATCH  /questions/:id/answer         — seller/admin answer
 *
 * Two routers from one file. app.ts mounts each at its prefix.
 */

// /questions/:id (PATCH/DELETE) + /questions/:id/answer (PATCH)
const router = Router();
router.patch("/:id",         requireAuth(), ctrl.edit);
router.delete("/:id",        requireAuth(), ctrl.remove);
router.patch("/:id/answer",  requireAuth(), ctrl.answer);
export default router;

// /products/:productId/questions  — list public, ask authed.
// mergeParams:true so req.params.productId resolves in the controller.
export const productQuestionsRouter = Router({ mergeParams: true });
productQuestionsRouter.get("/",  ctrl.list);                  // public
productQuestionsRouter.post("/", requireAuth(), ctrl.ask);    // authed
