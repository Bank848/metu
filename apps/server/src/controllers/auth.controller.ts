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

/**
 * Each handler: parse with the model's zod schema, delegate to the
 * service for business logic + Prisma, set / clear cookie via the
 * middleware helpers, return JSON.
 *
 * Errors flow through `next(err)` to `middleware/error.ts`, which
 * serialises `AppError` to `{ error: code, message }`.
 */

/**
 * Phase 16.3 — Mode A swap. The controller still owns:
 *   1. Input validation (zod) so the error surface is OUR shape,
 *      not better-auth's.
 *   2. Our service.login(), which runs the bcrypt + TOTP gate and
 *      throws our own AppError codes (InvalidCredentials,
 *      NeedsTotp, InvalidTotp).
 *   3. Cart side-effects baked into service.login().
 *
 * After our checks pass, we delegate ONE thing to better-auth:
 * the actual session creation. `auth.api.signInEmail()` writes a
 * `session` row + sets the signed cookie. We forward the Set-Cookie
 * header to the browser via Express. This costs one extra bcrypt
 * verify (~10 ms) — better-auth re-checks the password — vs the
 * old hand-rolled JWT minting. Worth it for the unified session
 * surface (our /sessions UI now sees every login).
 */
async function issueBetterAuthCookie(req: import("express").Request, res: import("express").Response, email: string, password: string) {
  // asResponse:true makes better-auth return a Web Response with
  // the Set-Cookie headers attached, instead of mutating an Express
  // response it doesn't know about.
  const webResponse = await betterAuth.api.signInEmail({
    body: { email, password },
    headers: expressHeadersToFetch(req),
    asResponse: true,
  });
  if (!webResponse.ok) {
    // If better-auth rejects (e.g. no credential row, password
    // mismatch via the bcrypt adapter, soft-deleted user), surface
    // a clean InvalidCredentials so the client UX matches the
    // service-level path.
    throw new AppError(401, "InvalidCredentials");
  }
  forwardSetCookieHeaders(res, webResponse);
}

export const login: RequestHandler = async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, "ValidationError", parsed.error.message);
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
    const { user } = await service.register(parsed.data);
    // Phase 16.3 — register also lands the user signed in via
    // better-auth. service.register has already provisioned the
    // credential `account` row, so signInEmail finds the bcrypt
    // hash and mints the session cookie cleanly.
    await issueBetterAuthCookie(req, res, parsed.data.email, parsed.data.password);
    res.json({ user });
  } catch (err) {
    next(err);
  }
};

export const logout: RequestHandler = async (req, res, next) => {
  try {
    // Phase 16.3 — better-auth signs out: deletes the current
    // session row + clears the cookie. Idempotent for an
    // already-anonymous request (returns 200 with no Set-Cookie).
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
  // Phase 15.5 — also surface requirePasswordReset so the BFF can
  // redirect every authed page to /profile/edit when an admin has
  // forced a reset. Cleared by successful change or set of password.
  // Phase 16.2 — also surface totpEnabled so /profile/edit can
  // render Disable vs Enrol-start. We deliberately DON'T leak the
  // totpSecret over /me — it's enrolment-only and lives in the
  // enroll-start response body only.
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

// =============================================================================
//  Phase 14.4 — phone + OTP
// =============================================================================

/** PATCH /auth/phone — set/update phone, clears phoneVerifiedAt. */
export const updatePhone: RequestHandler = async (req, res, next) => {
  try {
    const parsed = updatePhoneSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, "ValidationError", parsed.error.message);
    }
    const auth = currentAuth(req);
    if (!auth) throw new AppError(401, "Unauthorized");

    await service.updatePhone(auth.uid, parsed.data);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /auth/request-otp — issue 6-digit code via configured
 * transport (console in dev, Twilio when env set). Body always
 * empty; auth-gate proves identity.
 */
export const requestOtp: RequestHandler = async (req, res, next) => {
  try {
    const parsed = requestOtpSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      throw new AppError(400, "ValidationError", parsed.error.message);
    }
    const auth = currentAuth(req);
    if (!auth) throw new AppError(401, "Unauthorized");

    const result = await service.requestOtp(auth.uid, parsed.data);
    // Surface transport so the dev/demo UI can hint where the code
    // landed ("check server logs" vs "check your phone"). Production
    // should treat this as ephemeral metadata, not a security signal.
    res.json({ ok: true, transport: result.transport });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /auth/verify-otp — consume the pending code, set
 * phoneVerifiedAt. Distinct error codes (NoPendingOtp / OtpExpired
 * / InvalidOtp) so the UI can render helpful hints.
 */
export const verifyOtp: RequestHandler = async (req, res, next) => {
  try {
    const parsed = verifyOtpSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, "ValidationError", parsed.error.message);
    }
    const auth = currentAuth(req);
    if (!auth) throw new AppError(401, "Unauthorized");

    await service.verifyOtp(auth.uid, parsed.data);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};

// =============================================================================
//  Phase 15.2 — sessions UI endpoints
// =============================================================================

/**
 * Best-effort read of the current better-auth session id from the
 * request headers. Returns null when the user is signed in via our
 * legacy JWT cookie (no better-auth session row to identify).
 */
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

/** GET /auth/sessions — list current user's active better-auth sessions. */
export const listSessions: RequestHandler = async (req, res, next) => {
  try {
    const auth = currentAuth(req);
    if (!auth) throw new AppError(401, "Unauthorized");
    const sessions = await service.listSessions(auth.uid);
    // Surface which row is the "current" one so the UI can disable
    // its Revoke button.
    const currentSessionId = await readBetterAuthSessionId(req);
    res.json({ sessions, currentSessionId });
  } catch (err) {
    next(err);
  }
};

/** DELETE /auth/sessions/:id — revoke one session (ownership-checked). */
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

/**
 * DELETE /auth/sessions/all-others — "Sign out everywhere".
 * Revokes every better-auth session for the user EXCEPT the
 * current one (so the actor doesn't sign themselves out by
 * accident).
 */
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

// =============================================================================
//  Phase 16.2 — TOTP 2FA enrolment + management
// =============================================================================

/**
 * POST /auth/totp/enroll-start — Phase 16.2.
 *
 * Returns { secret, otpauthUri }. UI renders the otpauth:// as a QR
 * for authenticator apps. The base32 secret is also returned so the
 * UI can offer manual entry as a fallback (low-vision users, broken
 * camera). Both pieces are sensitive — surface them in the response
 * body but never log them.
 *
 * 400 AlreadyEnrolled when totpEnabled=true (must disable first).
 */
export const totpEnrollStart: RequestHandler = async (req, res, next) => {
  try {
    const parsed = totpEnrollStartSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      throw new AppError(400, "ValidationError", parsed.error.message);
    }
    const auth = currentAuth(req);
    if (!auth) throw new AppError(401, "Unauthorized");
    const result = await service.totpEnrollStart(auth.uid);
    res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /auth/totp/enroll-verify — Phase 16.2.
 *
 * Confirms the user holds the secret with the first 6-digit code.
 * Flips totpEnabled=true server-side. From then on /auth/login
 * requires a code in the body.
 */
export const totpEnrollVerify: RequestHandler = async (req, res, next) => {
  try {
    const parsed = totpEnrollVerifySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, "ValidationError", parsed.error.message);
    }
    const auth = currentAuth(req);
    if (!auth) throw new AppError(401, "Unauthorized");
    await service.totpEnrollVerify(auth.uid, parsed.data.code);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /auth/totp/step-up — Phase 23.3.
 *
 * Body: `{ code: string }`. On success stamps the better-auth
 * session's `lastTotpAt` so the requireRecent2FA(maxMin) middleware
 * lets the next sensitive request through. Each step-up is good for
 * the configured window (default 15 min) — past that the user
 * re-verifies.
 */
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

/**
 * POST /auth/totp/disable — Phase 16.2.
 *
 * Disables 2FA + wipes the secret. Requires the user's CURRENT
 * password (defence in depth — even a stolen session can't strip
 * 2FA without knowing the password too).
 */
export const totpDisable: RequestHandler = async (req, res, next) => {
  try {
    const parsed = totpDisableSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, "ValidationError", parsed.error.message);
    }
    const auth = currentAuth(req);
    if (!auth) throw new AppError(401, "Unauthorized");
    await service.totpDisable(auth.uid, parsed.data.password);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};

// =============================================================================
//  Phase 18 — connected social accounts
// =============================================================================

/**
 * GET /auth/connected-accounts — Phase 18.
 *
 * Returns the list of non-credential Account rows for the current user
 * (i.e. social providers like Google) plus a `googleEnabled` flag so
 * the UI can render "Link Google" vs "Google sign-in not configured".
 *
 * The `credential` provider row is filtered out — it's an internal
 * detail of the password sign-in path, not a user-facing "connected
 * account".
 */
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

/**
 * DELETE /auth/connected-accounts/google — Phase 18.
 *
 * Removes the Google Account row(s) for the current user. Refuses
 * with 400 PasswordNotSet if the user has no credential row — without
 * a password, unlinking would lock them out of their own account.
 *
 * Idempotent: if no Google row exists, returns 404 NotLinked.
 */
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
