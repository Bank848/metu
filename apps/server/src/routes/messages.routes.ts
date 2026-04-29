import { Router } from "express";
import * as ctrl from "../controllers/messages.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { sendMessageLimiter } from "../middleware/rate-limit.js";

/**
 * Phase 13.8 — messages router. Three endpoints, all auth-only.
 *
 *   GET  /messages           → inbox (no query) OR thread (?with=N)
 *   GET  /messages/unread    → cheap COUNT for the TopNav dot
 *   POST /messages           → send a message (self-send rejected)
 *
 * /messages/unread mounted BEFORE /:something to avoid the
 * (still-hypothetical) wildcard catch — Express matches by mount
 * order so the literal path wins.
 *
 * Phase 22 — POST /messages picks up a 30/min/user rate limit so a
 * compromised account (or an over-eager bot) can't flood inboxes.
 * GET inbox/unread stay un-limited — they're cheap COUNT-style reads.
 */
const router = Router();
router.get("/unread", requireAuth(), ctrl.unread);
router.get("/",      requireAuth(), ctrl.list);
router.post("/",     requireAuth(), sendMessageLimiter, ctrl.send);
export default router;
