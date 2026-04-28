import { Router } from "express";
import * as ctrl from "../controllers/products.controller.js";

const router = Router();

// Order matters — `/featured` must come before `/:id` or Express
// will treat "featured" as the dynamic id param.
router.get("/featured", ctrl.featured);
router.get("/:id",      ctrl.getOne);
router.get("/",         ctrl.browse);

export default router;
