import { Router } from "express";
import * as ctrl from "../controllers/stores.controller.js";

const router = Router();

router.get("/",    ctrl.list);
router.get("/:id", ctrl.getOne);

export default router;
