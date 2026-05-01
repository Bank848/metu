import { Router } from "express";
import * as ctrl from "../controllers/favorites.controller.js";
import { requireAuth } from "../middleware/auth.js";

// Favorites router. Auth-only join-table CRUD.
const router = Router();
router.get("/",                requireAuth(), ctrl.list);
router.post("/:productId",     requireAuth(), ctrl.add);
router.delete("/:productId",   requireAuth(), ctrl.remove);
export default router;
