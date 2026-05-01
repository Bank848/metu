import { Router } from "express";
import * as ctrl from "../controllers/settings.controller.js";
import { requireAuth } from "../middleware/auth.js";

// GET /settings (public) and PATCH /admin/settings (admin write).
const router = Router();
router.get("/", ctrl.getSettings);
export default router;

export const adminSettingsRouter = Router();
adminSettingsRouter.patch("/settings", requireAuth(["admin"]), ctrl.adminUpdate);
