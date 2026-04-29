import { Router } from "express";
import * as ctrl from "../controllers/settings.controller.js";
import { requireAuth } from "../middleware/auth.js";

/**
 * Phase 17.1 — system settings router.
 *
 *   GET   /settings           — public read (BFF caches it)
 *   PATCH /admin/settings     — admin write
 *
 * The admin path lives under /admin/* via the dedicated admin
 * router file so it picks up the existing admin sidebar / layout
 * conventions. We export both routers from this file so app.ts
 * mounts them on the right base paths.
 */
const router = Router();
router.get("/", ctrl.getSettings);
export default router;

export const adminSettingsRouter = Router();
adminSettingsRouter.patch("/settings", requireAuth(["admin"]), ctrl.adminUpdate);
