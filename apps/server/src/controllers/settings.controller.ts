import type { RequestHandler } from "express";
import { settingsPatchSchema } from "../models/settings.model.js";
import * as service from "../services/settings.service.js";
import { currentAuth } from "../middleware/auth.js";
import { AppError } from "../utils/errors.js";

// System settings: GET /settings is public; admin-only writes
// gate at the route layer.

export const getSettings: RequestHandler = async (_req, res, next) => {
  try {
    const settings = await service.getSettings();
    res.json({ settings });
  } catch (err) {
    next(err);
  }
};

export const adminUpdate: RequestHandler = async (req, res, next) => {
  try {
    const auth = currentAuth(req);
    if (!auth) throw new AppError(401, "Unauthorized");
    const parsed = settingsPatchSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      throw new AppError(400, "ValidationError", parsed.error.message);
    }
    const updated = await service.updateSettings(auth.uid, parsed.data, req);
    res.json({ ok: true, settings: updated });
  } catch (err) {
    next(err);
  }
};
