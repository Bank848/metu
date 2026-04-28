import { Router } from "express";
import * as ctrl from "../controllers/tags.controller.js";

const router = Router();
router.get("/", ctrl.list);
export default router;
