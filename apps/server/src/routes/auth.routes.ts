import { Router } from "express";
import * as ctrl from "../controllers/auth.controller.js";
import { requireAuth } from "../middleware/auth.js";
import {
  makeLimiter,
  registerLimiter,
  requestOtpLimiter,
} from "../middleware/rate-limit.js";
import { requireRecent2FA } from "../middleware/require-recent-2fa.js";

const router = Router();

// Public routes; each makeLimiter() call mints its own bucket.
router.post("/login",            makeLimiter({ max: 5, windowMs: 60_000 }), ctrl.login);
router.post("/login/request-otp", requestOtpLimiter,     ctrl.loginRequestOtp);
router.post("/login/verify",      makeLimiter({ max: 5, windowMs: 60_000 }), ctrl.loginVerify);
// Firebase Phone Auth: client retrieves its own E.164 phone here,
// runs signInWithPhoneNumber, then posts the ID token to /firebase-verify.
router.post(
  "/login/phone-for-sms",
  makeLimiter({ max: 10, windowMs: 60_000 }),
  ctrl.loginPhoneForSms,
);
router.post(
  "/login/firebase-verify",
  makeLimiter({ max: 5, windowMs: 60_000 }),
  ctrl.loginVerifyFirebase,
);
router.post("/register",         registerLimiter,        ctrl.register);
router.post("/logout",                                   ctrl.logout);
router.post("/forgot-password",         makeLimiter({ max: 3,  windowMs: 5 * 60_000 }), ctrl.forgotPassword);
router.post("/reset-password",          makeLimiter({ max: 5,  windowMs: 5 * 60_000 }), ctrl.resetPassword);
// POST keeps the token off access logs; GET kept for back-compat.
router.post("/reset-password/check",    makeLimiter({ max: 10, windowMs: 5 * 60_000 }), ctrl.checkResetToken);
router.get( "/reset-password/check",    makeLimiter({ max: 10, windowMs: 5 * 60_000 }), ctrl.checkResetToken);

// Mandatory verify flow at register.
router.post("/verify-email",            makeLimiter({ max: 5,  windowMs: 5 * 60_000 }), ctrl.verifyEmail);
router.post("/resend-email-verify",     makeLimiter({ max: 3,  windowMs: 5 * 60_000 }), ctrl.resendEmailVerify);
router.post("/verify-phone-register",   makeLimiter({ max: 5,  windowMs: 5 * 60_000 }), ctrl.verifyPhoneRegister);
router.post("/resend-phone-otp",        makeLimiter({ max: 3,  windowMs: 5 * 60_000 }), ctrl.resendPhoneOtp);
// Authed Firebase Phone Auth verify; stamps phoneVerifiedAt.
router.post("/verify-phone-firebase", requireAuth(), ctrl.verifyPhoneFirebase);
// Email-keyed variant for the no-cookie post-register page.
router.post(
  "/verify-phone-firebase-register",
  makeLimiter({ max: 5, windowMs: 5 * 60_000 }),
  ctrl.verifyPhoneFirebaseByEmail,
);
// Server-side throttle that gates Firebase SMS requests.
router.post(
  "/request-firebase-sms",
  makeLimiter({ max: 3, windowMs: 5 * 60_000 }),
  ctrl.requestFirebaseSms,
);

// Authed.
router.get("/me",                 requireAuth(), ctrl.me);
router.patch("/me",               requireAuth(), ctrl.updateMe);
// GDPR self-delete: body { confirmation } must match the username.
router.delete("/me",              requireAuth(), ctrl.deleteMe);
// In-form ensureSensitiveOtp gates this with TOTP code OR backup code
// (or SMS/email OTP for non-2FA users); session-level recent-2FA was
// redundant and broke backup-code submissions.
router.post("/change-password",   requireAuth(), makeLimiter({ max: 5, windowMs: 60_000 }), ctrl.changePassword);
// First-time password set for OAuth-only accounts.
router.post("/set-password",      requireAuth(), makeLimiter({ max: 5, windowMs: 60_000 }), ctrl.setPassword);

router.patch("/phone",            requireAuth(), ctrl.updatePhone);

// Sensitive change flows: OTP to current email first, then apply.
router.post("/me/email-change/start",  requireAuth(), ctrl.startEmailChange);
router.post("/me/email-change/verify", requireAuth(), makeLimiter({ max: 5, windowMs: 60_000 }), ctrl.verifyEmailChange);
router.post("/me/phone-change/start",  requireAuth(), ctrl.startPhoneChange);
router.post("/me/phone-change/verify", requireAuth(), makeLimiter({ max: 5, windowMs: 60_000 }), ctrl.verifyPhoneChange);
router.post("/request-otp",       requireAuth(), requestOtpLimiter, ctrl.requestOtp);
router.post("/verify-otp",        requireAuth(), makeLimiter({ max: 5, windowMs: 60_000 }), ctrl.verifyOtp);
// Email-OTP fallback when no verified phone is on file.
router.post("/request-email-otp", requireAuth(), requestOtpLimiter, ctrl.requestEmailOtp);
// Channel + redacted destination for the sensitive-change forms.
router.get( "/me/otp-channel",    requireAuth(), ctrl.getOtpChannel);

// Sessions UI. /all-others must mount before /:id so the literal path wins.
router.get("/sessions",                requireAuth(), ctrl.listSessions);
router.delete("/sessions/all-others",  requireAuth(), requireRecent2FA(15), ctrl.revokeAllOtherSessions);
router.delete("/sessions/:id",         requireAuth(), ctrl.revokeSession);

// TOTP 2FA. Every verify endpoint is rate-limited per route.
router.post("/totp/enroll-start",  requireAuth(), ctrl.totpEnrollStart);
router.post("/totp/enroll-verify", requireAuth(), makeLimiter({ max: 5, windowMs: 60_000 }), ctrl.totpEnrollVerify);
router.post("/totp/disable",       requireAuth(), makeLimiter({ max: 5, windowMs: 60_000 }), ctrl.totpDisable);
router.post("/totp/step-up",       requireAuth(), makeLimiter({ max: 5, windowMs: 60_000 }), ctrl.totpStepUp);
// Backup-code regeneration requires current password + fresh TOTP.
router.post("/totp/backup-codes/regenerate", requireAuth(), makeLimiter({ max: 5, windowMs: 60_000 }), ctrl.totpRegenerateBackupCodes);

// Connected social accounts; linking via better-auth.
router.get(   "/connected-accounts",         requireAuth(), ctrl.listConnectedAccounts);
router.delete("/connected-accounts/google",  requireAuth(), requireRecent2FA(15), ctrl.unlinkGoogle);

export default router;
