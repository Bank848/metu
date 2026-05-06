import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6).max(100),
  // Phase 16.2 — optional TOTP code. Required (server-enforced)
  // when the user has totpEnabled=true; UI sends it after the
  // first 401 NeedsTotp response.
  totpCode: z.string().regex(/^\d{6}$/).optional(),
  // Phase 49 — optional admin-OTP code + ownership confirmation.
  // Sent on the SECOND login round-trip after the server replies
  // with `NeedsAdminOtp` on the first call. The server requires
  // both `adminOtp` AND `confirmOwner=true` to complete the gate.
  adminOtp: z.string().regex(/^\d{6}$/).optional(),
  confirmOwner: z.boolean().optional(),
  trustDevice: z.boolean().optional(),
  // Phase 51 — Cloudflare Turnstile token. Required on the FIRST
  // round-trip (not when adminOtp is set). Verified server-side.
  captchaToken: z.string().optional(),
});

export const registerSchema = z.object({
  username: z.string().min(3).max(20).regex(/^[a-zA-Z0-9_]+$/, "alphanumeric + underscore only"),
  email: z.string().email(),
  password: z.string().min(6).max(100),
  firstName: z.string().min(1).max(40),
  lastName: z.string().min(1).max(40),
  // Phase 41 - phone is mandatory at register so the OTP flow has
  // somewhere to send the code. Accept E.164 (+66...) or plain digits.
  phone: z
    .string()
    .min(8)
    .max(20)
    .regex(/^\+?[0-9]{8,18}$/, "Phone must be 8-18 digits, optional leading +"),
  countryId: z.number().int().positive().optional(),
  gender: z.enum(["male", "female", "other"]).optional(),
  // ISO date string from <input type="date"> -- converted to Date in the API.
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

// Phase 41 - body for /auth/verify-phone-register and /auth/resend-phone-otp.
export const verifyPhoneRegisterSchema = z.object({
  email: z.string().email(),
  code: z.string().regex(/^\d{6}$/, "6-digit code"),
});
export const resendPhoneOtpSchema = z.object({
  email: z.string().email(),
});

// Phase 41 - body for /auth/verify-email and /auth/resend-email-verify.
export const verifyEmailSchema = z.object({
  token: z.string().min(20).max(120),
});
export const resendEmailVerifySchema = z.object({
  email: z.string().email(),
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

// Per CPE241 Business Rule 4d, the new password must be 8–30 chars
// AND include at least one special character. The previous regex was
// looser (>= 6, no special-char requirement); the rubric is explicit.
const strongPasswordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(30, "Password must be at most 30 characters")
  .regex(/[^A-Za-z0-9]/, "Password must include at least one special character");

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: strongPasswordSchema,
    confirmPassword: z.string().min(8).max(30),
    // Second-factor input. The service-side ensureSensitiveOtp picks
    // exactly one based on user state:
    //   • totpCode — when 2FA enabled (replaces SMS/email entirely)
    //   • backupCode — recovery path when 2FA enabled but the user
    //     can't access their authenticator (single-use)
    //   • otpCode — SMS (phone verified) OR email (no phone) OTP
    otpCode: z.string().regex(/^\d{6}$/).optional(),
    totpCode: z.string().regex(/^\d{6}$/).optional(),
    backupCode: z.string().min(10).max(20).optional(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
  // Phase 51 — Cloudflare Turnstile token. Verified server-side
  // before the email lookup so bots can't burn Resend quota.
  captchaToken: z.string().optional(),
});

export const resetPasswordSchema = z.object({
  // Raw token (URL-safe base64, ~43 chars for 32 bytes). Capped
  // generously to allow future formats without breaking the server.
  token: z.string().min(20).max(200),
  newPassword: strongPasswordSchema,
});

// First-time password set for OAuth-only users (no existing password
// to verify against). Endpoint refuses if the user already has a
// password — those go through changePassword.
export const setPasswordSchema = z
  .object({
    newPassword: strongPasswordSchema,
    confirmPassword: z.string().min(8).max(30),
    // Same second-factor channels as changePasswordSchema.
    otpCode: z.string().regex(/^\d{6}$/).optional(),
    totpCode: z.string().regex(/^\d{6}$/).optional(),
    backupCode: z.string().min(10).max(20).optional(),
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

// Phase 16.2 — TOTP enrolment + verification.
// enrollStart: empty body. Auth proves identity. Server returns
//              { secret, otpauthUri } so client can render the QR.
//              No-op (returns existing secret) when an enrolment is
//              already pending; rejects 400 AlreadyEnrolled when
//              totpEnabled=true (use disable + re-enroll for a fresh
//              secret).
export const totpEnrollStartSchema = z.object({});
// enrollVerify: confirm the secret with the first 6-digit code.
//               Server flips totpEnabled=true on success.
export const totpEnrollVerifySchema = z.object({
  code: z.string().regex(/^\d{6}$/, "Code must be 6 digits"),
});
// disable: requires the user's password (defence-in-depth — even a
//          stolen session can't disable 2FA without knowing the pw).
export const totpDisableSchema = z.object({
  password: z.string().min(6).max(100),
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
export type TotpEnrollStartInput = z.infer<typeof totpEnrollStartSchema>;
export type TotpEnrollVerifyInput = z.infer<typeof totpEnrollVerifySchema>;
export type TotpDisableInput = z.infer<typeof totpDisableSchema>;
export type VerifyPhoneRegisterInput = z.infer<typeof verifyPhoneRegisterSchema>;
export type ResendPhoneOtpInput = z.infer<typeof resendPhoneOtpSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export type ResendEmailVerifyInput = z.infer<typeof resendEmailVerifySchema>;
