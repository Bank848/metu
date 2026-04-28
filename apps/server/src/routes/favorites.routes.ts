import { Router } from "express";
import * as ctrl from "../controllers/favorites.controller.js";
import { requireAuth } from "../middleware/auth.js";

/**
 * Phase 13.7 — favorites router.
 *
 *   GET    /favorites              — list (auth)
 *   POST   /favorites/:productId   — heart (auth)
 *   DELETE /favorites/:productId   — un-heart (auth)
 *
 * All three endpoints are auth-only. The favourites page itself
 * pulls full product data via the catalog read endpoints; this
 * router just owns the join-table CRUD.
 */
const router = Router();
router.get("/",                requireAuth(), ctrl.list);
router.post("/:productId",     requireAuth(), ctrl.add);
router.delete("/:productId",   requireAuth(), ctrl.remove);
export default router;
