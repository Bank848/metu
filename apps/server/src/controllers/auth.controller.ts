import type { RequestHandler } from "express";
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  setPasswordSchema,
  updateProfileSchema,
} from "../models/auth.model.js";
import * as service from "../services/auth.service.js";
import {
  clearToken,
  currentAuth,
  currentUser,
  issueToken,
} from "../middleware/auth.js";
import { AppError } from "../utils/errors.js";
import { verifyTurnstile } from "../utils/turnstile.js";

/**
 * Each handler: parse with the model's zod schema, delegate to the
 * service for business logic + Prisma, set / clear cookie via the
 * middleware helpers, return JSON.
 *
 * Errors flow through `next(err)` to `middleware/error.ts`, which
 * serialises `AppError` to `{ error: code, message }`.
 */

export const login: RequestHandler = async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, "ValidationError", parsed.error.message);
    }
    const { user, role } = await service.login(parsed.data);
    issueToken(res, { uid: user.userId, role });
    res.json({ user });
  } catch (err) {
    next(err);
  }
};

export const register: RequestHandler = async (req, res, next) => {
  try {
    // CAPTCHA — runs BEFORE zod parse so a bot flood spends Cloudflare
    // siteverify quota, not our Neon round-trips. No-op when
    // `TURNSTILE_SECRET` is unset (local dev).
    const captchaToken =
      typeof req.body?.captchaToken === "string" ? req.body.captchaToken : undefined;
    const ip =
      (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ??
      (req.headers["x-real-ip"] as string | undefined) ??
      undefined;
    const captcha = await verifyTurnstile(captchaToken, ip);
    if (!captcha.ok) {
      throw new AppError(
        400,
        "CaptchaFailed",
        "Please complete the CAPTCHA and try again.",
      );
    }

    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, "ValidationError", parsed.error.message);
    }
    const { user, role } = await service.register(parsed.data);
    issueToken(res, { uid: user.userId, role });
    res.json({ user });
  } catch (err) {
    next(err);
  }
};

export const logout: RequestHandler = (_req, res) => {
  clearToken(res);
  res.json({ ok: true });
};

export const me: RequestHandler = (req, res) => {
  // currentUser() returns the FULL Prisma row including the bcrypt
  // password hash — strip it before sending. Without this guard,
  // GET /auth/me leaks the hash in every response (caught during
  // Phase 13.2 live smoke, BAD if the response is ever logged or
  // cached client-side). Single sanitize point keeps the rest of
  // middleware/auth.ts simple.
  const user = currentUser(req);
  const auth = currentAuth(req);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const { password, ...safe } = user;
  // Phase 14.3 — surface a `hasPassword` boolean so the BFF UI can
  // render the SET-password flow (no current pw needed) for
  // OAuth-only users instead of the change-password flow.
  res.json({ user: safe, role: auth?.role, hasPassword: Boolean(password) });
};

export const updateMe: RequestHandler = async (req, res, next) => {
  try {
    const parsed = updateProfileSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, "ValidationError", parsed.error.message);
    }
    const auth = currentAuth(req);
    const user = currentUser(req);
    if (!auth || !user) throw new AppError(401, "Unauthorized");

    const updated = await service.updateProfile(auth.uid, parsed.data, user.email);
    res.json({ ok: true, user: updated });
  } catch (err) {
    next(err);
  }
};

export const changePassword: RequestHandler = async (req, res, next) => {
  try {
    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, "ValidationError", parsed.error.message);
    }
    const auth = currentAuth(req);
    if (!auth) throw new AppError(401, "Unauthorized");

    await service.changePassword(auth.uid, parsed.data);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /auth/set-password — Phase 14.3.
 *
 * First-time password set for OAuth-only users (no existing
 * password to verify). Refuses with 400 PasswordAlreadySet when
 * the user already has one — those should call changePassword.
 *
 * Auth required. Doesn't issue a fresh cookie — the user is
 * already signed in via Google when they hit this.
 */
export const setPassword: RequestHandler = async (req, res, next) => {
  try {
    const parsed = setPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, "ValidationError", parsed.error.message);
    }
    const auth = currentAuth(req);
    if (!auth) throw new AppError(401, "Unauthorized");

    await service.setPassword(auth.uid, parsed.data);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /auth/forgot-password — accepts ANY input shape and ALWAYS
 * returns the same generic body so an attacker can't enumerate
 * registered emails. Validation failure → still 200 + generic message.
 */
export const forgotPassword: RequestHandler = async (req, res, next) => {
  try {
    const parsed = forgotPasswordSchema.safeParse(req.body);
    if (parsed.success) {
      // Service is silent — never throws to prevent enumeration.
      await service.forgotPassword(parsed.data);
    }
    res.json({
      ok: true,
      message: "If that email is registered, a reset link is on the way.",
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /auth/reset-password — consume a token, write a new hash.
 * Service throws `AppError(400, "InvalidToken")` for any rejection
 * mode (missing / consumed / expired) so the surface stays flat.
 */
export const resetPassword: RequestHandler = async (req, res, next) => {
  try {
    const parsed = resetPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, "ValidationError", parsed.error.message);
    }
    await service.resetPassword(parsed.data);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};
