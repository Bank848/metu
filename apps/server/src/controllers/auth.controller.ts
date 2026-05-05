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

/**
 * single-session enforcement. After every successful
 * sign-in we drop every OTHER session row for the same user, so a
 * concurrent login from another browser kicks the previous tab out
 * (its next API request gets 401 and the BFF bounces it to /login).
 * The "newest session row wins" heuristic is good enough — we just
 * minted one through better-auth, so the most recent createdAt for
 * this userId is ours. A second simultaneous sign-in race would only
 * keep one anyway, which is exactly the desired behavior.
 */
async function enforceSingleSession(userId: number): Promise<void> {
  const { prisma } = await import("../db/prisma.js");
  const latest = await prisma.session.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (!latest) return;
  await prisma.session.deleteMany({
    where: { userId, NOT: { id: latest.id } },
  });
}

export const login: RequestHandler = async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      throw parsed.error;
    }

    // CAPTCHA on login too. Without this a botnet can
    // distribute credential-stuffing across IPs and dodge the per-IP
    // rate limit. The Step-2 admin-OTP round-trip skips CAPTCHA so
    // submitting the OTP code doesn't require a fresh widget render.
    if (!parsed.data.adminOtp) {
      const captchaToken =
        typeof req.body?.captchaToken === "string" ? req.body.captchaToken : undefined;
      const ip =
        (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ??
        (req.headers["x-real-ip"] as string | undefined) ??
        undefined;
      const captcha = await verifyTurnstile(captchaToken, ip);
      if (!captcha.ok) {
        throw new AppError(400, "CaptchaFailed", "Please complete the CAPTCHA and try again.");
      }
    }

    // Step 1 — password + TOTP + verify gates. Throws on failure.
    const { user } = await service.login(parsed.data);

    // Step 2 — Phase 49 admin-OTP gate. Only fires for guarded
    // accounts (defaults to admin@metu.dev — the public seed account
    // anyone with the URL can attempt to sign in to). Trusted devices
    // (the user ticked "trust for 7 days" on a previous successful
    // OTP) skip the gate entirely.
    const { isGuardedAccount, issueAdminOtp, verifyAdminOtp } = await import(
      "../utils/admin-login-otp.js"
    );
    const { isTrustedDevice, trustThisDevice } = await import(
      "../utils/trusted-device.js"
    );

    if (isGuardedAccount(parsed.data.email)) {
      const trusted = await isTrustedDevice(req, user.userId);
      if (!trusted) {
        // Sub-step A — OTP code provided + ownership confirmed.
        if (parsed.data.adminOtp && parsed.data.confirmOwner) {
          await verifyAdminOtp(user.userId, parsed.data.adminOtp);
          // Pass — fall through to issue the better-auth cookie.
        } else if (parsed.data.adminOtp && !parsed.data.confirmOwner) {
          throw new AppError(
            400,
            "OwnershipNotConfirmed",
            "Tick the confirmation checkbox before submitting the code.",
          );
        } else {
          // Sub-step B — first round, send code + return NeedsAdminOtp.
          const sent = await issueAdminOtp(user.userId, parsed.data.email);
          throw new AppError(
            401,
            "NeedsAdminOtp",
            `A 6-digit code was sent to ${sent.recipientMasked}. Enter it to finish signing in.`,
            {
              recipientMasked: sent.recipientMasked,
              ...(sent.devCode ? { devCode: sent.devCode } : {}),
            },
          );
        }
      }
    }

    // Step 3 — issue the better-auth session cookie.
    await issueBetterAuthCookie(req, res, parsed.data.email, parsed.data.password);

    // Step 4 — single-session kick-out. Any concurrent session for
    // this user gets dropped; the previously-logged-in browser will
    // 401 on its next API call.
    await enforceSingleSession(user.userId);

    // Step 5 — if the user ticked "trust this device for 7 days"
    // alongside a successful OTP gate, mint the trust cookie now.
    if (
      parsed.data.trustDevice &&
      parsed.data.confirmOwner &&
      isGuardedAccount(parsed.data.email)
    ) {
      await trustThisDevice(req, res, user.userId);
    }

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
    const { user, role, demo } = await service.register(parsed.data);
    await issueBetterAuthCookie(req, res, parsed.data.email, parsed.data.password);
    // register also enforces single-session for symmetry
    // with login (a malicious party can't keep a stale session alive
    // by re-registering with the same address; the fresh session is
    // the only one that survives).
    await enforceSingleSession(user.userId);
    res.json({ user, role, ...(demo ? { demo } : {}) });
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
  const { password, totpSecret, phoneOtpHash, phoneOtpExpiresAt, ...safe } = user as any;
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

/**
 * GDPR self-delete. Authed user removes their own account.
 * Body must contain `{ confirmation: string }` matching their
 * username so a misclick on the button doesn't blow the account
 * away. Internally calls `admin.service.deleteUser(uid, uid, ...)`
 * with no reason, which routes through the hybrid path:
 *   - fresh accounts (no orders/reviews/transactions) → hard delete
 *   - accounts with history → anonymise (PII removed, ledger kept)
 * Bypasses the SelfDeleteForbidden guard inside admin.service by
 * checking it here first, then delegating with `actor === target`
 * disabled via a tiny direct flow (we can't reuse admin.service
 * verbatim because of that guard).
 */
export const deleteMe: RequestHandler = async (req, res, next) => {
  try {
    const auth = currentAuth(req);
    const user = currentUser(req);
    if (!auth || !user) throw new AppError(401, "Unauthorized");
    const confirmation = String((req.body ?? {}).confirmation ?? "").trim();
    if (confirmation !== user.username) {
      throw new AppError(
        400,
        "ConfirmationMismatch",
        "Type your username exactly to confirm account deletion.",
      );
    }
    await service.selfDelete(auth.uid, req);
    // Best-effort cookie clear so the browser doesn't keep a session
    // for an account that no longer exists. better-auth's session row
    // is gone (cascade or anonymise drops it) but the cookie copy
    // lingers until the browser hits an authed endpoint.
    res.clearCookie("better-auth.session_token", { path: "/" });
    res.json({ ok: true });
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
    // CAPTCHA gate so a botnet can't email-bomb arbitrary
    // users via the password-reset endpoint (each request burns
    // Resend quota and clutters the victim's inbox).
    const captchaToken =
      typeof req.body?.captchaToken === "string" ? req.body.captchaToken : undefined;
    const ip =
      (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ??
      (req.headers["x-real-ip"] as string | undefined) ??
      undefined;
    const captcha = await verifyTurnstile(captchaToken, ip);
    if (!captcha.ok) {
      // Same generic OK response — don't leak whether CAPTCHA was
      // the failure reason vs. the email being unknown.
      res.json({
        ok: true,
        message: "If that email is registered, a reset link is on the way.",
      });
      return;
    }

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

// confirm email-verify token from the magic link.
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

// resend a fresh email-verify link. Always returns 200.
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

// confirm 6-digit OTP after register.
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

// verify a Firebase Phone Auth ID token + stamp our
// `phoneVerifiedAt`. Authed route — caller must be the user we'll
// stamp. Body: { idToken: string }.
export const verifyPhoneFirebase: RequestHandler = async (req, res, next) => {
  try {
    const auth = currentAuth(req);
    if (!auth) throw new AppError(401, "Unauthorized");
    const idToken = String((req.body ?? {}).idToken ?? "");
    if (!idToken) {
      throw new AppError(400, "MissingIdToken", "idToken is required.");
    }
    const out = await service.verifyPhoneFirebase(auth.uid, idToken);
    res.json({ ok: true, ...out });
  } catch (err) {
    next(err);
  }
};

// ── Sensitive change flows (email + phone) ─────────────────────────
export const startEmailChange: RequestHandler = async (req, res, next) => {
  try {
    const auth = currentAuth(req); if (!auth) throw new AppError(401, "Unauthorized");
    const u = await currentUser(req); if (!u) throw new AppError(401, "Unauthorized");
    const newEmail = String((req.body ?? {}).newEmail ?? "");
    if (!newEmail) throw new AppError(400, "MissingFields", "newEmail is required.");
    await service.startEmailChange(auth.uid, u.email, newEmail);
    res.json({ ok: true });
  } catch (err) { next(err); }
};

export const verifyEmailChange: RequestHandler = async (req, res, next) => {
  try {
    const auth = currentAuth(req); if (!auth) throw new AppError(401, "Unauthorized");
    const u = await currentUser(req); if (!u) throw new AppError(401, "Unauthorized");
    const newEmail = String((req.body ?? {}).newEmail ?? "");
    const code = String((req.body ?? {}).code ?? "");
    if (!newEmail || !code) throw new AppError(400, "MissingFields", "newEmail and code are required.");
    const updated = await service.verifyEmailChange(auth.uid, u.email, newEmail, code);
    res.json({ ok: true, user: updated });
  } catch (err) { next(err); }
};

export const startPhoneChange: RequestHandler = async (req, res, next) => {
  try {
    const auth = currentAuth(req); if (!auth) throw new AppError(401, "Unauthorized");
    const u = await currentUser(req); if (!u) throw new AppError(401, "Unauthorized");
    const newPhone = String((req.body ?? {}).newPhone ?? "");
    if (!newPhone) throw new AppError(400, "MissingFields", "newPhone is required.");
    await service.startPhoneChange(auth.uid, u.email, newPhone);
    res.json({ ok: true });
  } catch (err) { next(err); }
};

export const verifyPhoneChange: RequestHandler = async (req, res, next) => {
  try {
    const auth = currentAuth(req); if (!auth) throw new AppError(401, "Unauthorized");
    const newPhone = String((req.body ?? {}).newPhone ?? "");
    const code = String((req.body ?? {}).code ?? "");
    if (!newPhone || !code) throw new AppError(400, "MissingFields", "newPhone and code are required.");
    const updated = await service.verifyPhoneChange(auth.uid, newPhone, code);
    res.json({ ok: true, user: updated });
  } catch (err) { next(err); }
};

// Same as verifyPhoneFirebase but keyed on the email body field instead
// of a session — used by the post-register /verify-phone page when no
// cookie exists yet.
export const verifyPhoneFirebaseByEmail: RequestHandler = async (req, res, next) => {
  try {
    const email = String((req.body ?? {}).email ?? "").trim();
    const idToken = String((req.body ?? {}).idToken ?? "");
    if (!email || !idToken) {
      throw new AppError(400, "MissingFields", "email and idToken are required.");
    }
    const out = await service.verifyPhoneFirebaseByEmail(email, idToken);
    res.json({ ok: true, ...out });
  } catch (err) {
    next(err);
  }
};

// Server-side gate the client must pass BEFORE asking Firebase to send
// an SMS. Firebase Phone Auth bypasses our backend (browser → Firebase),
// so without this gate the client-side localStorage limit is the only
// throttle and easily bypassed (clear storage / incognito / scripts).
export const requestFirebaseSms: RequestHandler = async (req, res, next) => {
  try {
    const email = String((req.body ?? {}).email ?? "").trim();
    if (!email) {
      throw new AppError(400, "MissingFields", "email is required.");
    }
    const out = await service.gateFirebaseSmsRequest(email);
    res.json(out);
  } catch (err) {
    next(err);
  }
};

// resend a fresh OTP after register. Always 200.
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
