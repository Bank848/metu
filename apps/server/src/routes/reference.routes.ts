import { Router } from "express";
import * as ctrl from "../controllers/reference.controller.js";

// Public reference data: business-types and countries.
const router = Router();
router.get("/business-types", ctrl.businessTypes);
router.get("/countries",      ctrl.countries);
export default router;
