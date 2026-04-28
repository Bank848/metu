import { Router } from "express";
import * as ctrl from "../controllers/stock-alerts.controller.js";
import { requireAuth } from "../middleware/auth.js";

/**
 * Phase 13.7 — stock alerts router.
 *
 *   POST   /stock-alerts/:productItemId   — subscribe (auth)
 *   DELETE /stock-alerts/:productItemId   — unsubscribe (auth)
 *
 * No GET endpoint today — buyers don't need to enumerate their
 * pending alerts (the bell button on each variant page reflects
 * state via the seeded subscription set we hydrate server-side
 * from the catalog read).
 */
const router = Router();
router.post("/:productItemId",   requireAuth(), ctrl.subscribe);
router.delete("/:productItemId", requireAuth(), ctrl.unsubscribe);
export default router;
