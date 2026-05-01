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

// Authed.
router.get("/me",                 requireAuth(), ctrl.me);
router.patch("/me",               requireAuth(), ctrl.updateMe);
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
