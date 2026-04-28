import { Router } from "express";
import * as ctrl from "../controllers/coupons.controller.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.post("/validate", requireAuth(), ctrl.validate);

export default router;
