import { Router } from "express";
import * as ctrl from "../controllers/auth.controller.js";
import { requireAuth } from "../middleware/auth.js";
import {
  forgotPasswordLimiter,
  loginLimiter,
  registerLimiter,
  requestOtpLimiter,
} from "../middleware/rate-limit.js";

const router = Router();

// Public — Phase 15.1 rate-limited. Per-route limiters share state
// across requests (singletons in middleware/rate-limit.ts).
router.post("/login",            loginLimiter,           ctrl.login);
router.post("/register",         registerLimiter,        ctrl.register);
router.post("/logout",                                   ctrl.logout);
router.post("/forgot-password",  forgotPasswordLimiter,  ctrl.forgotPassword);
router.post("/reset-password",                           ctrl.resetPassword);

// Authed — requireAuth() resolves req.auth + req.user before handler
router.get("/me",                 requireAuth(), ctrl.me);
router.patch("/me",               requireAuth(), ctrl.updateMe);
router.post("/change-password",   requireAuth(), ctrl.changePassword);
// Phase 14.3 — first-time password set for OAuth-only users.
router.post("/set-password",      requireAuth(), ctrl.setPassword);

// Phase 14.4 — phone + OTP scaffold.
// Phase 15.1 — request-otp also rate-limited (cap SMS spend).
router.patch("/phone",            requireAuth(), ctrl.updatePhone);
router.post("/request-otp",       requireAuth(), requestOtpLimiter, ctrl.requestOtp);
router.post("/verify-otp",        requireAuth(), ctrl.verifyOtp);

// Phase 15.2 — sessions UI. Lists + revokes better-auth's session
// rows for the current user. The legacy JWT cookie path doesn't
// have rows here; clearing it is "change your password" or "logout".
// /all-others mounted BEFORE /:id so the literal path wins the
// route match (Express matches by registration order within router).
router.get("/sessions",                requireAuth(), ctrl.listSessions);
router.delete("/sessions/all-others",  requireAuth(), ctrl.revokeAllOtherSessions);
router.delete("/sessions/:id",         requireAuth(), ctrl.revokeSession);

// Phase 16.2 — TOTP 2FA enrolment + management. Three endpoints,
// all auth-only. Login itself takes optional totpCode in body
// (handled in the existing POST /login) — these three only
// manage the secret + enabled flag.
router.post("/totp/enroll-start",  requireAuth(), ctrl.totpEnrollStart);
router.post("/totp/enroll-verify", requireAuth(), ctrl.totpEnrollVerify);
router.post("/totp/disable",       requireAuth(), ctrl.totpDisable);

export default router;
