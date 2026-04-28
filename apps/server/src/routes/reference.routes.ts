import { Router } from "express";
import * as ctrl from "../controllers/reference.controller.js";

/**
 * Phase 13.11 — reference data router. Replaces the legacy flat
 * `catalog.ts` (the last unmounted-but-imported file) with proper
 * layered separation. Two endpoints, both public:
 *
 *   GET /business-types   business categories for become-seller form
 *   GET /countries        country list for register form
 *
 * Mounted at `/` in app.ts so the URLs stay `GET /business-types`
 * + `GET /countries` (matches the BFF's existing /api/business-types
 * + /api/countries paths once they're proxied).
 */
const router = Router();
router.get("/business-types", ctrl.businessTypes);
router.get("/countries",      ctrl.countries);
export default router;
