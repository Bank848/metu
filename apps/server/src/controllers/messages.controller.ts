import type { RequestHandler } from "express";
import { sendMessageSchema } from "../models/messages.model.js";
import * as service from "../services/messages.service.js";
import { getSettings } from "../services/settings.service.js";
import { currentAuth } from "../middleware/auth.js";
import { AppError } from "../utils/errors.js";

/**
 * GET /messages
 *   ?with=<userId>  → full thread (also marks the other side's
 *                     messages as read)
 *   (no query)      → "inbox" — last message per partner + unread
 *                     count, sorted by most-recent activity
 */
export const list: RequestHandler = async (req, res, next) => {
  try {
    const auth = currentAuth(req);
    if (!auth) throw new AppError(401, "Unauthorized");

    const withParam = req.query.with;
    if (typeof withParam === "string" && withParam.length > 0) {
      const otherId = Number(withParam);
      if (!Number.isFinite(otherId)) throw new AppError(400, "BadId");
      const thread = await service.getThread(auth.uid, otherId);
      res.json(thread);
      return;
    }

    const inbox = await service.getInbox(auth.uid);
    res.json(inbox);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /messages — send a message. Self-send rejected with 400
 * (otherwise users could write to their own inbox by mistake or
 * via a malformed link).
 *
 * Phase 19 — refused with 403 ChatDisabled when admin has flipped
 * `SystemSetting.chatEnabled = false`. GET inbox/thread/unread are
 * deliberately NOT gated so users can still read their history (same
 * pattern as favorites — disabling never destroys data).
 */
export const send: RequestHandler = async (req, res, next) => {
  try {
    const auth = currentAuth(req);
    if (!auth) throw new AppError(401, "Unauthorized");

    const settings = await getSettings();
    if (!settings.chatEnabled) {
      throw new AppError(
        403,
        "ChatDisabled",
        "Messaging is currently disabled by the administrator.",
      );
    }

    const parsed = sendMessageSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, "ValidationError", parsed.error.message);
    }
    if (parsed.data.recipientId === auth.uid) {
      throw new AppError(400, "SelfSend");
    }

    const message = await service.sendMessage(auth.uid, parsed.data);
    res.json({ ok: true, message });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /messages/unread — single COUNT query for the TopNav dot.
 * Polled client-side every few seconds (no realtime infra).
 */
export const unread: RequestHandler = async (req, res, next) => {
  try {
    const auth = currentAuth(req);
    if (!auth) throw new AppError(401, "Unauthorized");
    const count = await service.getUnreadCount(auth.uid);
    res.json({ count });
  } catch (err) {
    next(err);
  }
};
