import { Router } from "express";
import * as ctrl from "../controllers/auth.controller.js";
import { requireAuth } from "../middleware/auth.js";
import {
  loginLimiter,
  makeLimiter,
  registerLimiter,
  requestOtpLimiter,
} from "../middleware/rate-limit.js";
import { requireRecent2FA } from "../middleware/require-recent-2fa.js";

const router = Router();

// Public, rate-limited.
router.post("/login",            loginLimiter,           ctrl.login);
// Two-step login verify. Both endpoints rate-limited under the OTP
// budget so a leaked pre-auth token can't be brute-forced.
router.post("/login/request-otp", requestOtpLimiter,     ctrl.loginRequestOtp);
router.post("/login/verify",      loginLimiter,          ctrl.loginVerify);
router.post("/register",         registerLimiter,        ctrl.register);
router.post("/logout",                                   ctrl.logout);
// PENTEST-112: each recovery / verify route gets its own limiter
// instance so a burst on /forgot-password doesn't drain the bucket
// shared with /verify-email / /resend-phone-otp etc. (cross-route DoS).
// Caps are unchanged from the previous shared 3 / 5min for parity.
router.post("/forgot-password",         makeLimiter({ max: 3,  windowMs: 5 * 60_000 }), ctrl.forgotPassword);
// PENTEST-313/314: rate-limit reset-password to prevent leaked-token
// brute-force / replay. Reset-password is the route an attacker with a
// stolen token would actually grind, so allow a slightly higher max
// (5/5min) than /forgot-password — legitimate users typically only
// retry once or twice on validation errors.
router.post("/reset-password",          makeLimiter({ max: 5,  windowMs: 5 * 60_000 }), ctrl.resetPassword);
// POST keeps the token in the body so it never lands in
// access logs. GET stays for backward compatibility.
router.post("/reset-password/check",    makeLimiter({ max: 10, windowMs: 5 * 60_000 }), ctrl.checkResetToken);
router.get( "/reset-password/check",    makeLimiter({ max: 10, windowMs: 5 * 60_000 }), ctrl.checkResetToken);

// mandatory verify flow at register. All public, rate-limited.
router.post("/verify-email",            makeLimiter({ max: 5,  windowMs: 5 * 60_000 }), ctrl.verifyEmail);
router.post("/resend-email-verify",     makeLimiter({ max: 3,  windowMs: 5 * 60_000 }), ctrl.resendEmailVerify);
router.post("/verify-phone-register",   makeLimiter({ max: 5,  windowMs: 5 * 60_000 }), ctrl.verifyPhoneRegister);
router.post("/resend-phone-otp",        makeLimiter({ max: 3,  windowMs: 5 * 60_000 }), ctrl.resendPhoneOtp);
// alternative phone-verify path: client uses Firebase Phone
// Auth (10 free SMS/day on the Spark plan), hands us back the ID
// token, and we mark phoneVerifiedAt. Authed because we mutate the
// caller's row.
router.post("/verify-phone-firebase", requireAuth(), ctrl.verifyPhoneFirebase);
// Email-keyed variant for the post-register /verify-phone page where
// no session cookie exists yet.
router.post(
  "/verify-phone-firebase-register",
  makeLimiter({ max: 5, windowMs: 5 * 60_000 }),
  ctrl.verifyPhoneFirebaseByEmail,
);
// Server-side throttle the client hits BEFORE asking Firebase to send
// an SMS. Dedicated bucket so SMS-cost throttling is independent of
// the other public verify routes.
router.post(
  "/request-firebase-sms",
  makeLimiter({ max: 3, windowMs: 5 * 60_000 }),
  ctrl.requestFirebaseSms,
);

// Authed.
router.get("/me",                 requireAuth(), ctrl.me);
router.patch("/me",               requireAuth(), ctrl.updateMe);
// GDPR self-delete. Body: { confirmation: string } must
// match the user's username. Routes through admin.deleteUser's
// hybrid logic so fresh accounts hard-delete and accounts with
// history anonymise (no need to duplicate the branch).
router.delete("/me",              requireAuth(), ctrl.deleteMe);
// Sensitive ops require a fresh TOTP step-up.
router.post("/change-password",   requireAuth(), requireRecent2FA(15), ctrl.changePassword);
// PENTEST-311/314: rate-limit set-password (no requireRecent2FA — service
// gates this behind ensureSensitiveOtp + only allows users without an
// existing password). loginLimiter (5/min) prevents grinding from a
// stolen session.
router.post("/set-password",      requireAuth(), loginLimiter, ctrl.setPassword);

router.patch("/phone",            requireAuth(), ctrl.updatePhone);

// Sensitive change flows: OTP to current email first, then apply.
router.post("/me/email-change/start",  requireAuth(), ctrl.startEmailChange);
// PENTEST-313: throttle OTP-verify on identity-change flows.
router.post("/me/email-change/verify", requireAuth(), loginLimiter, ctrl.verifyEmailChange);
router.post("/me/phone-change/start",  requireAuth(), ctrl.startPhoneChange);
router.post("/me/phone-change/verify", requireAuth(), loginLimiter, ctrl.verifyPhoneChange);
router.post("/request-otp",       requireAuth(), requestOtpLimiter, ctrl.requestOtp);
// PENTEST-312: rate-limit verify-otp so a stolen session can't grind
// 6-digit codes at network speed.
router.post("/verify-otp",        requireAuth(), loginLimiter, ctrl.verifyOtp);
// Email-OTP fallback for sensitive password ops when the user has no
// verified phone. Same Verification row + identifier as SMS so only
// one pending code per user across channels.
router.post("/request-email-otp", requireAuth(), requestOtpLimiter, ctrl.requestEmailOtp);
// Tells the client which channel the change-password / change-email /
// change-phone form should render (totp / sms / email) + a redacted
// hint of the destination.
router.get( "/me/otp-channel",    requireAuth(), ctrl.getOtpChannel);

// Sessions UI. /all-others must mount before /:id so the literal path wins.
router.get("/sessions",                requireAuth(), ctrl.listSessions);
router.delete("/sessions/all-others",  requireAuth(), requireRecent2FA(15), ctrl.revokeAllOtherSessions);
router.delete("/sessions/:id",         requireAuth(), ctrl.revokeSession);

// TOTP 2FA. PENTEST-312/314: every verify endpoint must be rate-limited
// so a stolen session can't grind 6-digit TOTPs at network speed.
router.post("/totp/enroll-start",  requireAuth(), ctrl.totpEnrollStart);
router.post("/totp/enroll-verify", requireAuth(), loginLimiter, ctrl.totpEnrollVerify);
router.post("/totp/disable",       requireAuth(), loginLimiter, ctrl.totpDisable);
router.post("/totp/step-up",       requireAuth(), loginLimiter, ctrl.totpStepUp);
// Backup-code regeneration. Requires current password + a fresh TOTP
// code so a stolen session alone can't rotate the backup set.
router.post("/totp/backup-codes/regenerate", requireAuth(), loginLimiter, ctrl.totpRegenerateBackupCodes);

// Connected social accounts. Linking goes through better-auth's
// /auth/better/sign-in/google flow inside an active session.
router.get(   "/connected-accounts",         requireAuth(), ctrl.listConnectedAccounts);
router.delete("/connected-accounts/google",  requireAuth(), requireRecent2FA(15), ctrl.unlinkGoogle);

export default router;
