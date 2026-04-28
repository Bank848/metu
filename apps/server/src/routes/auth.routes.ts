import { Router } from "express";
import * as ctrl from "../controllers/auth.controller.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// Public
router.post("/login",            ctrl.login);
router.post("/register",         ctrl.register);
router.post("/logout",           ctrl.logout);
router.post("/forgot-password",  ctrl.forgotPassword);   // 13.2.1
router.post("/reset-password",   ctrl.resetPassword);    // 13.2.1

// Authed — requireAuth() resolves req.auth + req.user before handler
router.get("/me",                 requireAuth(), ctrl.me);
router.patch("/me",               requireAuth(), ctrl.updateMe);
router.post("/change-password",   requireAuth(), ctrl.changePassword);
// Phase 14.3 — first-time password set for OAuth-only users.
router.post("/set-password",      requireAuth(), ctrl.setPassword);

export default router;
