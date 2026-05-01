import type { RequestHandler } from "express";
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  requestOtpSchema,
  resetPasswordSchema,
  setPasswordSchema,
  totpDisableSchema,
  totpEnrollStartSchema,
  totpEnrollVerifySchema,
  updatePhoneSchema,
  updateProfileSchema,
  verifyOtpSchema,
  verifyEmailSchema,
  resendEmailVerifySchema,
  verifyPhoneRegisterSchema,
  resendPhoneOtpSchema,
} from "../models/auth.model.js";
import * as service from "../services/auth.service.js";
import {
  currentAuth,
  currentUser,
  expressHeadersToFetch,
  forwardSetCookieHeaders,
} from "../middleware/auth.js";
import { auth as betterAuth } from "../lib/auth.js";
import { AppError } from "../utils/errors.js";
import { verifyTurnstile } from "../utils/turnstile.js";

// We own validation + bcrypt + TOTP via service.login(); better-auth
// only mints the session cookie. asResponse:true returns a Web
// Response whose Set-Cookie headers we forward to Express.
async function issueBetterAuthCookie(req: import("express").Request, res: import("express").Response, email: string, password: string) {
  const webResponse = await betterAuth.api.signInEmail({
    body: { email, password },
    headers: expressHeadersToFetch(req),
    asResponse: true,
  });
  if (!webResponse.ok) {
    throw new AppError(401, "InvalidCredentials");
  }
  forwardSetCookieHeaders(res, webResponse);
}

export const login: RequestHandler = async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      throw parsed.error;
    }
    const { user } = await service.login(parsed.data);
    await issueBetterAuthCookie(req, res, parsed.data.email, parsed.data.password);
    res.json({ user });
  } catch (err) {
    next(err);
  }
};

export const register: RequestHandler = async (req, res, next) => {
  try {
    // CAPTCHA before zod so bot floods burn Cloudflare quota, not Neon.
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
      throw parsed.error;
    }
    const { user } = await service.register(parsed.data);
    await issueBetterAuthCookie(req, res, parsed.data.email, parsed.data.password);
    res.json({ user });
  } catch (err) {
    next(err);
  }
};

export const logout: RequestHandler = async (req, res, next) => {
  try {
    const webResponse = await betterAuth.api.signOut({
      headers: expressHeadersToFetch(req),
      asResponse: true,
    });
    forwardSetCookieHeaders(res, webResponse);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};

export const me: RequestHandler = (req, res) => {
  // Strip the bcrypt hash before responding.
  const user = currentUser(req);
  const auth = currentAuth(req);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const { password, ...safe } = user;
  // hasPassword + requirePasswordReset + totpEnabled drive UI flows.
  res.json({
    user: safe,
    role: auth?.role,
    hasPassword: Boolean(password),
    requirePasswordReset: Boolean((user as any).requirePasswordReset),
    totpEnabled: Boolean((user as any).totpEnabled),
  });
};

export const updateMe: RequestHandler = async (req, res, next) => {
  try {
    const parsed = updateProfileSchema.safeParse(req.body);
    if (!parsed.success) {
      throw parsed.error;
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
      throw parsed.error;
    }
    const auth = currentAuth(req);
    if (!auth) throw new AppError(401, "Unauthorized");

    await service.changePassword(auth.uid, parsed.data);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};

// First-time password set for OAuth-only users.
export const setPassword: RequestHandler = async (req, res, next) => {
  try {
    const parsed = setPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      throw parsed.error;
    }
    const auth = currentAuth(req);
    if (!auth) throw new AppError(401, "Unauthorized");

    await service.setPassword(auth.uid, parsed.data);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};

/** PATCH /auth/phone. Clears phoneVerifiedAt on update. */
export const updatePhone: RequestHandler = async (req, res, next) => {
  try {
    const parsed = updatePhoneSchema.safeParse(req.body);
    if (!parsed.success) {
      throw parsed.error;
    }
    const auth = currentAuth(req);
    if (!auth) throw new AppError(401, "Unauthorized");

    await service.updatePhone(auth.uid, parsed.data);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};

// POST /auth/request-otp. Auth-gate proves identity.
export const requestOtp: RequestHandler = async (req, res, next) => {
  try {
    const parsed = requestOtpSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      throw parsed.error;
    }
    const auth = currentAuth(req);
    if (!auth) throw new AppError(401, "Unauthorized");

    const result = await service.requestOtp(auth.uid, parsed.data);
    res.json({ ok: true, transport: result.transport });
  } catch (err) {
    next(err);
  }
};

// POST /auth/verify-otp. Stamps phoneVerifiedAt on success.
export const verifyOtp: RequestHandler = async (req, res, next) => {
  try {
    const parsed = verifyOtpSchema.safeParse(req.body);
    if (!parsed.success) {
      throw parsed.error;
    }
    const auth = currentAuth(req);
    if (!auth) throw new AppError(401, "Unauthorized");

    await service.verifyOtp(auth.uid, parsed.data);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};

// Returns null for legacy JWT-only sessions.
async function readBetterAuthSessionId(req: import("express").Request): Promise<number | null> {
  try {
    const { auth: betterAuth } = await import("../lib/auth.js");
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) {
      if (typeof v === "string") headers.set(k, v);
      else if (Array.isArray(v)) headers.set(k, v.join(", "));
    }
    const result = await betterAuth.api.getSession({ headers });
    if (!result?.session?.id) return null;
    const id = Number(result.session.id);
    return Number.isFinite(id) ? id : null;
  } catch {
    return null;
  }
}

/** GET /auth/sessions. Surfaces the current session id so the UI
 * can disable its own Revoke button. */
export const listSessions: RequestHandler = async (req, res, next) => {
  try {
    const auth = currentAuth(req);
    if (!auth) throw new AppError(401, "Unauthorized");
    const sessions = await service.listSessions(auth.uid);
    const currentSessionId = await readBetterAuthSessionId(req);
    res.json({ sessions, currentSessionId });
  } catch (err) {
    next(err);
  }
};

/** DELETE /auth/sessions/:id. Ownership checked. */
export const revokeSession: RequestHandler<{ id: string }> = async (req, res, next) => {
  try {
    const auth = currentAuth(req);
    if (!auth) throw new AppError(401, "Unauthorized");
    const sessionId = Number(req.params.id);
    if (!Number.isFinite(sessionId)) throw new AppError(400, "BadId");
    await service.revokeSession(auth.uid, sessionId);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};

/** DELETE /auth/sessions/all-others. */
export const revokeAllOtherSessions: RequestHandler = async (req, res, next) => {
  try {
    const auth = currentAuth(req);
    if (!auth) throw new AppError(401, "Unauthorized");
    const currentSessionId = await readBetterAuthSessionId(req);
    const result = await service.revokeAllOtherSessions(auth.uid, currentSessionId);
    res.json({ ok: true, revoked: result.revoked });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /auth/forgot-password. Always returns the same body to
 * prevent email enumeration; validation failure also lands on 200.
 */
export const forgotPassword: RequestHandler = async (req, res, next) => {
  try {
    const parsed = forgotPasswordSchema.safeParse(req.body);
    if (parsed.success) {
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
 * Validity probe without consuming the token.
 *   POST /auth/reset-password/check  body: { token }
 *   GET  /auth/reset-password/check?token=xxx (legacy)
 *
 * The POST shape keeps the token off URLs and access logs (Phase 42
 * URL hardening); the GET shape is preserved for backward compat.
 */
export const checkResetToken: RequestHandler = async (req, res, next) => {
  try {
    const bodyToken =
      req.body && typeof (req.body as { token?: unknown }).token === "string"
        ? (req.body as { token: string }).token
        : "";
    const token = bodyToken || String(req.query.token ?? "");
    const result = await service.checkResetToken(token);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

/** POST /auth/reset-password. Service uses a single InvalidToken code. */
export const resetPassword: RequestHandler = async (req, res, next) => {
  try {
    const parsed = resetPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      throw parsed.error;
    }
    await service.resetPassword(parsed.data);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};

// Phase 41 - confirm email-verify token from the magic link.
export const verifyEmail: RequestHandler = async (req, res, next) => {
  try {
    const parsed = verifyEmailSchema.safeParse(req.body);
    if (!parsed.success) {
      throw parsed.error;
    }
    await service.verifyEmail(parsed.data.token);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};

// Phase 41 - resend a fresh email-verify link. Always returns 200.
export const resendEmailVerify: RequestHandler = async (req, res, next) => {
  try {
    const parsed = resendEmailVerifySchema.safeParse(req.body);
    let demo: { emailToken: string } | undefined;
    if (parsed.success) {
      const out = await service.resendEmailVerify(parsed.data.email);
      demo = out.demo;
    }
    res.json({
      ok: true,
      message: "If that email is registered, a fresh link is on the way.",
      ...(demo ? { demo } : {}),
    });
  } catch (err) {
    next(err);
  }
};

// Phase 41 - confirm 6-digit OTP after register.
export const verifyPhoneRegister: RequestHandler = async (req, res, next) => {
  try {
    const parsed = verifyPhoneRegisterSchema.safeParse(req.body);
    if (!parsed.success) {
      throw parsed.error;
    }
    await service.verifyPhoneRegister(parsed.data.email, parsed.data.code);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};

// Phase 41 - resend a fresh OTP after register. Always 200.
export const resendPhoneOtp: RequestHandler = async (req, res, next) => {
  try {
    const parsed = resendPhoneOtpSchema.safeParse(req.body);
    let demo: { otp: string } | undefined;
    if (parsed.success) {
      const out = await service.resendPhoneOtp(parsed.data.email);
      demo = out.demo;
    }
    res.json({ ok: true, ...(demo ? { demo } : {}) });
  } catch (err) {
    next(err);
  }
};

/** POST /auth/totp/enroll-start. Returns base32 secret + otpauth URI. */
export const totpEnrollStart: RequestHandler = async (req, res, next) => {
  try {
    const parsed = totpEnrollStartSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      throw parsed.error;
    }
    const auth = currentAuth(req);
    if (!auth) throw new AppError(401, "Unauthorized");
    const result = await service.totpEnrollStart(auth.uid);
    res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
};

/** POST /auth/totp/enroll-verify. First valid code flips totpEnabled. */
export const totpEnrollVerify: RequestHandler = async (req, res, next) => {
  try {
    const parsed = totpEnrollVerifySchema.safeParse(req.body);
    if (!parsed.success) {
      throw parsed.error;
    }
    const auth = currentAuth(req);
    if (!auth) throw new AppError(401, "Unauthorized");
    await service.totpEnrollVerify(auth.uid, parsed.data.code);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};

/** POST /auth/totp/step-up. Stamps Session.lastTotpAt for requireRecent2FA. */
export const totpStepUp: RequestHandler = async (req, res, next) => {
  try {
    const auth = currentAuth(req);
    if (!auth) throw new AppError(401, "Unauthorized");
    const code = typeof req.body?.code === "string" ? req.body.code.trim() : "";
    if (!/^[0-9]{6}$/.test(code)) {
      throw new AppError(400, "ValidationError", "Code must be 6 digits.");
    }
    const sessionId = await readBetterAuthSessionId(req);
    await service.totpStepUp(auth.uid, sessionId, code);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};

/** POST /auth/totp/disable. Requires the user's current password. */
export const totpDisable: RequestHandler = async (req, res, next) => {
  try {
    const parsed = totpDisableSchema.safeParse(req.body);
    if (!parsed.success) {
      throw parsed.error;
    }
    const auth = currentAuth(req);
    if (!auth) throw new AppError(401, "Unauthorized");
    await service.totpDisable(auth.uid, parsed.data.password);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};

/** GET /auth/connected-accounts. Excludes the credential row. */
export const listConnectedAccounts: RequestHandler = async (req, res, next) => {
  try {
    const auth = currentAuth(req);
    if (!auth) throw new AppError(401, "Unauthorized");
    const accounts = await service.listConnectedAccounts(auth.uid);
    res.json({
      accounts,
      googleEnabled: Boolean(process.env.GOOGLE_CLIENT_ID),
    });
  } catch (err) {
    next(err);
  }
};

/** DELETE /auth/connected-accounts/google. */
export const unlinkGoogle: RequestHandler = async (req, res, next) => {
  try {
    const auth = currentAuth(req);
    if (!auth) throw new AppError(401, "Unauthorized");
    await service.unlinkGoogle(auth.uid);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};
