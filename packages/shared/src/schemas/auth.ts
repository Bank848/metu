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
    // Phase 15.3 — when the user has verified their phone, the
    // server requires this OTP. Schema treats it as optional here
    // so users without phone verification can still change passwords;
    // the service-side guard enforces presence + freshness.
    otpCode: z.string().regex(/^\d{6}$/).optional(),
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
    // Phase 15.3 — same OTP enforcement story as changePasswordSchema.
    // OAuth-only users without a verified phone can still set their
    // first password; once they verify a phone, future password ops
    // gate on a fresh OTP.
    otpCode: z.string().regex(/^\d{6}$/).optional(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

// Phase 14.4 — phone + OTP scaffold.
//
// Phone format: liberal — international numbers vary wildly. Accept
// digits, leading +, spaces, hyphens, parens. Cap to VARCHAR(20)
// minus a margin so a normalised version always fits. Server-side
// will strip non-digits before storing.
export const updatePhoneSchema = z.object({
  phone: z
    .string()
    .min(7)
    .max(20)
    .regex(/^[+()\d\s-]+$/, "Use digits, +, spaces, hyphens, or parens"),
});

// requestOtp: empty body — auth-gate proves identity, server reads
// User.phone to know where to send. Returns 400 NoPhoneOnFile if
// the user hasn't set one.
export const requestOtpSchema = z.object({});

// verifyOtp: 6-digit numeric code typed by the user from SMS.
export const verifyOtpSchema = z.object({
  code: z.string().regex(/^\d{6}$/, "Code must be 6 digits"),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type SetPasswordInput = z.infer<typeof setPasswordSchema>;
export type UpdatePhoneInput = z.infer<typeof updatePhoneSchema>;
export type RequestOtpInput = z.infer<typeof requestOtpSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
