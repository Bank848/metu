import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6).max(100),
});

export const registerSchema = z.object({
  username: z.string().min(3).max(20).regex(/^[a-zA-Z0-9_]+$/, "alphanumeric + underscore only"),
  email: z.string().email(),
  password: z.string().min(6).max(100),
  firstName: z.string().min(1).max(40),
  lastName: z.string().min(1).max(40),
  countryId: z.number().int().positive().optional(),
  gender: z.enum(["male", "female", "other"]).optional(),
  // ISO date string from <input type="date"> — converted to Date in the API.
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const updateProfileSchema = z.object({
  firstName: z.string().min(1).max(40).optional(),
  lastName: z.string().min(1).max(40).optional(),
  email: z.string().email().optional(),
  profileImage: z.string().url().optional(),
  countryId: z.number().int().positive().optional(),
  gender: z.enum(["male", "female", "other"]).optional(),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(6).max(100),
    confirmPassword: z.string().min(6).max(100),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  // Raw token (URL-safe base64, ~43 chars for 32 bytes). Capped
  // generously to allow future formats without breaking the server.
  token: z.string().min(20).max(200),
  newPassword: z.string().min(6).max(100),
});

// Phase 14.3 — first-time password set for OAuth-only users (no
// existing password to verify against). Endpoint refuses if the
// user already has a password — those go through changePassword.
export const setPasswordSchema = z
  .object({
    newPassword: z.string().min(6).max(100),
    confirmPassword: z.string().min(6).max(100),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type SetPasswordInput = z.infer<typeof setPasswordSchema>;
