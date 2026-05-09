import { Router } from "express";
import * as ctrl from "../controllers/gift.controller.js";
import { softAuth } from "../middleware/auth.js";

// Gift redemption endpoint. softAuth attaches req.user when a session
// cookie is present so the controller can match it against the order's
// giftRecipientEmail; never rejects unauthenticated callers because
// the page itself drives the sign-in handoff.
const router = Router();
router.use(softAuth());
router.get("/:orderId", ctrl.getGift);

export default router;
