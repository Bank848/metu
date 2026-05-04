import { Router } from "express";
import * as ctrl from "../controllers/auth.controller.js";
import { requireAuth } from "../middleware/auth.js";
import {
  forgotPasswordLimiter,
  loginLimiter,
  registerLimiter,
  requestOtpLimiter,
} from "../middleware/rate-limit.js";
import { requireRecent2FA } from "../middleware/require-recent-2fa.js";

const router = Router();

// Public, rate-limited.
router.post("/login",            loginLimiter,           ctrl.login);
router.post("/register",         registerLimiter,        ctrl.register);
router.post("/logout",                                   ctrl.logout);
router.post("/forgot-password",  forgotPasswordLimiter,  ctrl.forgotPassword);
router.post("/reset-password",                           ctrl.resetPassword);
// POST keeps the token in the body so it never lands in
// access logs. GET stays for backward compatibility.
router.post("/reset-password/check",                     ctrl.checkResetToken);
router.get("/reset-password/check",                      ctrl.checkResetToken);

// mandatory verify flow at register. All public, rate-limited.
router.post("/verify-email",         forgotPasswordLimiter, ctrl.verifyEmail);
router.post("/resend-email-verify",  forgotPasswordLimiter, ctrl.resendEmailVerify);
router.post("/verify-phone-register", forgotPasswordLimiter, ctrl.verifyPhoneRegister);
router.post("/resend-phone-otp",      forgotPasswordLimiter, ctrl.resendPhoneOtp);
// alternative phone-verify path: client uses Firebase Phone
// Auth (10 free SMS/day on the Spark plan), hands us back the ID
// token, and we mark phoneVerifiedAt. Authed because we mutate the
// caller's row.
router.post("/verify-phone-firebase", requireAuth(), ctrl.verifyPhoneFirebase);

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
router.post("/set-password",      requireAuth(), ctrl.setPassword);

router.patch("/phone",            requireAuth(), ctrl.updatePhone);
router.post("/request-otp",       requireAuth(), requestOtpLimiter, ctrl.requestOtp);
router.post("/verify-otp",        requireAuth(), ctrl.verifyOtp);

// Sessions UI. /all-others must mount before /:id so the literal path wins.
router.get("/sessions",                requireAuth(), ctrl.listSessions);
router.delete("/sessions/all-others",  requireAuth(), requireRecent2FA(15), ctrl.revokeAllOtherSessions);
router.delete("/sessions/:id",         requireAuth(), ctrl.revokeSession);

// TOTP 2FA.
router.post("/totp/enroll-start",  requireAuth(), ctrl.totpEnrollStart);
router.post("/totp/enroll-verify", requireAuth(), ctrl.totpEnrollVerify);
router.post("/totp/disable",       requireAuth(), ctrl.totpDisable);
router.post("/totp/step-up",       requireAuth(), ctrl.totpStepUp);

// Connected social accounts. Linking goes through better-auth's
// /auth/better/sign-in/google flow inside an active session.
router.get(   "/connected-accounts",         requireAuth(), ctrl.listConnectedAccounts);
router.delete("/connected-accounts/google",  requireAuth(), requireRecent2FA(15), ctrl.unlinkGoogle);

export default router;
