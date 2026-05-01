import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import type { UserRole } from "@prisma/client";
import { prisma } from "../db/prisma.js";
import { AppError } from "../utils/errors.js";
import { findFirstProfaneField } from "../utils/profanity.js";
import { sendEmail } from "../utils/email.js";
import { renderEmailLayout, escapeHtml } from "../utils/email-template.js";
import { audit } from "../utils/audit.js";
import type {
  ChangePasswordInput,
  ForgotPasswordInput,
  LoginInput,
  RegisterInput,
  RequestOtpInput,
  ResetPasswordInput,
  SafeUser,
  SetPasswordInput,
  UpdatePhoneInput,
  UpdateProfileInput,
  VerifyOtpInput,
} from "../models/auth.model.js";
import {
  deliverCode,
  expiresAt as otpExpiresAt,
  generateCode,
  hashCode,
  otpIdentifier,
  otpTransport,
} from "../utils/otp.js";
import { buildOtpauthUri, generateSecret, verifyCode as verifyTotpCode } from "../utils/totp.js";

// Strip the bcrypt hash before returning a user object.
function sanitize(user: any): SafeUser {
  if (!user) return user;
  const { password, ...safe } = user;
  return safe as SafeUser;
}

const BCRYPT_ROUNDS = 10;

// Mirror user.password into better-auth's credential account row so
// signInEmail can verify against the same hash. Idempotent (upsert).
export async function syncCredentialAccount(
  userId: number,
  email: string,
  passwordHash: string,
): Promise<void> {
  await prisma.account.upsert({
    where: { providerId_accountId: { providerId: "credential", accountId: email } },
    create: {
      userId,
      providerId: "credential",
      accountId: email,
      password: passwordHash,
    },
    update: {
      userId,
      password: passwordHash,
    },
  });
}

export interface AuthOutcome {
  user: SafeUser;
  role: UserRole;
}

// Verify credentials. Throws 401 for any failure mode so callers
// can't distinguish wrong email vs wrong password vs deleted user.
export async function login(input: LoginInput): Promise<AuthOutcome> {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    include: {
      stats: true,
      carts: { where: { status: "active" }, take: 1, select: { cartId: true } },
    },
  });
  if (!user || user.deletedAt) {
    throw new AppError(401, "InvalidCredentials");
  }
  // Google-only users have a NULL password; same response as wrong password.
  if (!user.password) throw new AppError(401, "InvalidCredentials");
  const ok = await bcrypt.compare(input.password, user.password);
  if (!ok) throw new AppError(401, "InvalidCredentials");

  // TOTP gate runs AFTER password check so we don't leak whether 2FA is on.
  if (user.totpEnabled && user.totpSecret) {
    if (!input.totpCode) {
      throw new AppError(401, "NeedsTotp");
    }
    const totpOk = await verifyTotpCode(input.totpCode, user.totpSecret);
    if (!totpOk) {
      throw new AppError(401, "InvalidTotp");
    }
  }

  // Fire-and-forget active cart creation if missing.
  if (user.carts.length === 0) {
    void prisma.cart
      .create({ data: { userId: user.userId, status: "active" } })
      .catch(() => {});
  }

  const role = (user.stats?.role ?? "buyer") as UserRole;
  return { user: sanitize(user), role };
}

/**
 * Register a new buyer. Runs profanity gate before duplicate check.
 * Throws 400 ProfanityRejected or 409 Conflict (username/email).
 */
export async function register(input: RegisterInput): Promise<AuthOutcome> {
  const profane = findFirstProfaneField({
    username: input.username,
    firstName: input.firstName,
    lastName: input.lastName,
  });
  if (profane) {
    throw new AppError(400, "ProfanityRejected", profane.message);
  }

  const [dupUsername, dupEmail] = await Promise.all([
    prisma.user.findUnique({ where: { username: input.username } }),
    prisma.user.findUnique({ where: { email: input.email } }),
  ]);
  if (dupUsername) throw new AppError(409, "Conflict", "username");
  if (dupEmail) throw new AppError(409, "Conflict", "email");

  const hash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
  const user = await prisma.user.create({
    data: {
      username: input.username,
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      countryId: input.countryId,
      gender: input.gender,
      // Pin DOB to UTC midnight so it doesn't drift across timezones.
      dateOfBirth: input.dateOfBirth
        ? new Date(`${input.dateOfBirth}T00:00:00.000Z`)
        : undefined,
      password: hash,
      stats: { create: { role: "buyer" } },
      carts: { create: { status: "active" } },
    },
    include: { stats: true },
  });

  await syncCredentialAccount(user.userId, user.email, hash);

  await audit({
    actorId: user.userId,
    action: "user.register",
    targetType: "user",
    targetId: user.userId,
    meta: { email: user.email },
  });

  return { user: sanitize(user), role: (user.stats?.role ?? "buyer") as UserRole };
}

// GET /auth/me. Returns null for missing or soft-deleted users.
export async function getById(userId: number): Promise<SafeUser | null> {
  const user = await prisma.user.findUnique({
    where: { userId },
    include: { stats: true, store: true },
  });
  if (!user || user.deletedAt) return null;
  return sanitize(user);
}

// PATCH /auth/me. Profanity gate + email uniqueness (only if email changed).
export async function updateProfile(
  userId: number,
  input: UpdateProfileInput,
  currentEmail: string,
): Promise<SafeUser> {
  const profane = findFirstProfaneField({
    firstName: input.firstName,
    lastName: input.lastName,
  });
  if (profane) {
    throw new AppError(400, "ProfanityRejected", profane.message);
  }

  if (input.email && input.email !== currentEmail) {
    const dup = await prisma.user.findUnique({
      where: { email: input.email },
      select: { userId: true },
    });
    if (dup && dup.userId !== userId) {
      throw new AppError(409, "Conflict", "email");
    }
  }

  const data: Record<string, unknown> = {};
  if (input.firstName !== undefined) data.firstName = input.firstName;
  if (input.lastName !== undefined) data.lastName = input.lastName;
  if (input.email !== undefined) data.email = input.email;
  if (input.profileImage !== undefined) data.profileImage = input.profileImage;
  if (input.countryId !== undefined) data.countryId = input.countryId;
  if (input.gender !== undefined) data.gender = input.gender;
  if (input.dateOfBirth !== undefined) {
    data.dateOfBirth = new Date(`${input.dateOfBirth}T00:00:00.000Z`);
  }

  const updated = await prisma.user.update({
    where: { userId },
    data,
    include: { stats: true },
  });

  // Keep the credential account_id in sync with the new email.
  if (input.email && input.email !== currentEmail) {
    await prisma.account.updateMany({
      where: { userId, providerId: "credential", accountId: currentEmail },
      data: { accountId: input.email },
    });
  }
  return sanitize(updated);
}

// POST /auth/change-password. Requires the current password.
export async function changePassword(
  userId: number,
  input: ChangePasswordInput,
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { userId },
    select: { password: true, phone: true, phoneVerifiedAt: true },
  });
  if (!user) throw new AppError(404, "UserNotFound");
  // Google-only users must use /auth/set-password instead.
  if (!user.password) throw new AppError(400, "NoPasswordSet");

  const ok = await bcrypt.compare(input.currentPassword, user.password);
  if (!ok) throw new AppError(401, "InvalidCurrentPassword");

  // Require a fresh OTP if the user has verified their phone.
  await ensureSensitiveOtpIfVerified(userId, user.phone, user.phoneVerifiedAt, input.otpCode);

  const hash = await bcrypt.hash(input.newPassword, BCRYPT_ROUNDS);
  const updated = await prisma.user.update({
    where: { userId },
    data: { password: hash, requirePasswordReset: false },
    select: { email: true },
  });
  await syncCredentialAccount(userId, updated.email, hash);
  await audit({
    actorId: userId,
    action: "auth.password.change",
    targetType: "user",
    targetId: userId,
  });
}

/**
 * POST /auth/set-password. First-time password set for OAuth-only
 * users (User.password is NULL). Refuses if password already set.
 */
export async function setPassword(
  userId: number,
  input: SetPasswordInput,
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { userId },
    select: { password: true, phone: true, phoneVerifiedAt: true },
  });
  if (!user) throw new AppError(404, "UserNotFound");
  if (user.password) throw new AppError(400, "PasswordAlreadySet");

  await ensureSensitiveOtpIfVerified(userId, user.phone, user.phoneVerifiedAt, input.otpCode);

  const hash = await bcrypt.hash(input.newPassword, BCRYPT_ROUNDS);
  const updated = await prisma.user.update({
    where: { userId },
    data: { password: hash, requirePasswordReset: false },
    select: { email: true },
  });
  await syncCredentialAccount(userId, updated.email, hash);
  await audit({
    actorId: userId,
    action: "user.set_password",
    targetType: "user",
    targetId: userId,
  });
}

/**
 * Require a fresh OTP for sensitive password ops when the user has a
 * verified phone. No-op otherwise. Consumes the verification row on
 * success. Throws 400 OtpRequired/InvalidOtp/NoPendingOtp/OtpExpired.
 */
async function ensureSensitiveOtpIfVerified(
  userId: number,
  phone: string | null,
  phoneVerifiedAt: Date | null,
  otpCode: string | undefined,
): Promise<void> {
  if (!phone || !phoneVerifiedAt) return;

  if (!otpCode) throw new AppError(400, "OtpRequired");

  const identifier = otpIdentifier(userId);
  const pending = await prisma.verification.findFirst({
    where: { identifier },
    orderBy: { createdAt: "desc" },
  });
  if (!pending) throw new AppError(400, "NoPendingOtp");
  if (pending.expiresAt.getTime() < Date.now()) {
    await prisma.verification.delete({ where: { id: pending.id } });
    throw new AppError(400, "OtpExpired");
  }

  const expected = hashCode(userId, phone, otpCode);
  if (expected !== pending.value) throw new AppError(400, "InvalidOtp");

  // Consume so the same code can't be replayed against another action.
  await prisma.verification.delete({ where: { id: pending.id } });
}

/**
 * PATCH /auth/phone. Clears phoneVerifiedAt and normalises the
 * number. OTP delivery is a separate POST /auth/request-otp call.
 */
export async function updatePhone(
  userId: number,
  input: UpdatePhoneInput,
): Promise<void> {
  const normalised = input.phone.replace(/[^\d+]/g, "");
  if (normalised.length < 7) throw new AppError(400, "PhoneTooShort");

  await prisma.user.update({
    where: { userId },
    data: { phone: normalised, phoneVerifiedAt: null },
  });
}

/**
 * POST /auth/request-otp. Issues a 6-digit code; latest code wins.
 * Returns the transport name so the demo UI can hint console vs SMS.
 */
export async function requestOtp(
  userId: number,
  _input: RequestOtpInput,
): Promise<{ transport: typeof otpTransport }> {
  const user = await prisma.user.findUnique({
    where: { userId },
    select: { phone: true },
  });
  if (!user) throw new AppError(404, "UserNotFound");
  if (!user.phone) throw new AppError(400, "NoPhoneOnFile");

  const code = generateCode();
  const hash = hashCode(userId, user.phone, code);
  const identifier = otpIdentifier(userId);

  // Only one active OTP per user.
  await prisma.verification.deleteMany({ where: { identifier } });
  await prisma.verification.create({
    data: { identifier, value: hash, expiresAt: otpExpiresAt() },
  });

  // 502 on failure so the client knows the code didn't actually go out.
  try {
    await deliverCode(user.phone, code);
  } catch (err) {
    throw new AppError(
      502,
      "OtpDeliveryFailed",
      err instanceof Error ? err.message : String(err),
    );
  }

  return { transport: otpTransport };
}

/**
 * POST /auth/verify-otp. Consume the pending code and stamp
 * phoneVerifiedAt. Throws 400 NoPendingOtp/OtpExpired/InvalidOtp.
 */
export async function verifyOtp(
  userId: number,
  input: VerifyOtpInput,
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { userId },
    select: { phone: true },
  });
  if (!user) throw new AppError(404, "UserNotFound");
  if (!user.phone) throw new AppError(400, "NoPhoneOnFile");

  const identifier = otpIdentifier(userId);
  const pending = await prisma.verification.findFirst({
    where: { identifier },
    orderBy: { createdAt: "desc" },
  });
  if (!pending) throw new AppError(400, "NoPendingOtp");
  if (pending.expiresAt.getTime() < Date.now()) {
    await prisma.verification.delete({ where: { id: pending.id } });
    throw new AppError(400, "OtpExpired");
  }

  const expected = hashCode(userId, user.phone, input.code);
  if (expected !== pending.value) {
    throw new AppError(400, "InvalidOtp");
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { userId },
      data: { phoneVerifiedAt: new Date() },
    }),
    prisma.verification.delete({ where: { id: pending.id } }),
  ]);

  await audit({
    actorId: userId,
    action: "user.phone_verified",
    targetType: "user",
    targetId: userId,
    meta: { phone: user.phone.slice(-4) }, // last 4 only - PII
  });
}

// GET /auth/sessions. List active better-auth sessions, newest first.
export async function listSessions(userId: number) {
  const rows = await prisma.session.findMany({
    where: { userId, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      createdAt: true,
      expiresAt: true,
      ipAddress: true,
      userAgent: true,
    },
  });
  return rows;
}

// DELETE /auth/sessions/:id. Ownership-checked via the userId predicate.
export async function revokeSession(userId: number, sessionId: number): Promise<void> {
  const result = await prisma.session.deleteMany({
    where: { id: sessionId, userId },
  });
  if (result.count === 0) throw new AppError(404, "SessionNotFound");
}

/**
 * DELETE /auth/sessions/all-others. Revokes every session except the
 * current one (or all of them if currentSessionId is null).
 */
export async function revokeAllOtherSessions(
  userId: number,
  currentSessionId: number | null,
): Promise<{ revoked: number }> {
  const where: { userId: number; id?: { not: number } } = { userId };
  if (currentSessionId !== null) {
    where.id = { not: currentSessionId };
  }
  const result = await prisma.session.deleteMany({ where });
  await audit({
    actorId: userId,
    action: "user.sessions_revoked",
    targetType: "user",
    targetId: userId,
    meta: { revoked: result.count, kept: currentSessionId !== null ? 1 : 0 },
  });
  return { revoked: result.count };
}

const RESET_TOKEN_TTL_MIN = 5;

/**
 * POST /auth/forgot-password. Always succeeds (no email enumeration).
 * Stores SHA-256 of the token; raw token only goes in the email link.
 */
export async function forgotPassword(input: ForgotPasswordInput): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user || user.deletedAt) return;

  const raw = crypto.randomBytes(32).toString("base64url");
  const tokenHash = crypto.createHash("sha256").update(raw).digest("hex");
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MIN * 60_000);

  await prisma.passwordResetToken.create({
    data: { userId: user.userId, tokenHash, expiresAt },
  });

  // Link points at the BFF where /reset-password lives.
  const base = process.env.SITE_URL ?? "https://metu.fly.dev";
  const link = `${base}/reset-password?token=${raw}`;

  const firstName = user.firstName ?? "there";
  const html = renderEmailLayout({
    heading: `Hi ${escapeHtml(firstName)} — reset your password`,
    intro: `Click the button below to set a new password. The link is valid for <strong>${RESET_TOKEN_TTL_MIN} minutes</strong>, after that you'll need to request another one.`,
    cta: { label: "Reset password", url: link },
    fallbackUrl: link,
    bodyHtml: `
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
      <p style="margin: 0; font-size: 13px; line-height: 1.6; color: #94a3b8;">
        Didn't ask to reset your password? You can ignore this email - your current password stays unchanged. The link expires automatically and can only be used once.
      </p>
    `,
  });
  const text = [
    `Hi ${firstName},`,
    "",
    `Reset your METU password using this link (valid ${RESET_TOKEN_TTL_MIN} minutes):`,
    link,
    "",
    "Didn't ask for this? Ignore the email - your password stays the same.",
    "",
    "- METU",
  ].join("\n");

  await sendEmail({
    to: user.email,
    subject: "Reset your METU password",
    html,
    text,
  });
}

/**
 * POST /auth/reset-password. Consume a valid token + write new hash.
 * Single InvalidToken error code for any rejection (missing/used/expired).
 */
export async function resetPassword(input: ResetPasswordInput): Promise<void> {
  const tokenHash = crypto.createHash("sha256").update(input.token).digest("hex");
  const row = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
  });
  if (!row || row.consumedAt || row.expiresAt < new Date()) {
    throw new AppError(
      400,
      "InvalidToken",
      "This reset link has expired or already been used.",
    );
  }

  const hash = await bcrypt.hash(input.newPassword, BCRYPT_ROUNDS);

  // Update password, mark token consumed, invalidate other outstanding tokens.
  const [updatedUser] = await prisma.$transaction([
    prisma.user.update({
      where: { userId: row.userId },
      data: { password: hash, requirePasswordReset: false },
      select: { email: true },
    }),
    prisma.passwordResetToken.update({
      where: { tokenId: row.tokenId },
      data: { consumedAt: new Date() },
    }),
    prisma.passwordResetToken.updateMany({
      where: { userId: row.userId, consumedAt: null, NOT: { tokenId: row.tokenId } },
      data: { consumedAt: new Date() },
    }),
  ]);

  await syncCredentialAccount(row.userId, updatedUser.email, hash);

  await audit({
    actorId: row.userId,
    action: "auth.password_reset",
    targetType: "user",
    targetId: row.userId,
  });
}

/**
 * POST /auth/totp/enroll-start. Returns the base32 secret + otpauth
 * URI. Idempotent mid-enrolment; refuses if 2FA is already enabled.
 */
export async function totpEnrollStart(
  userId: number,
): Promise<{ secret: string; otpauthUri: string }> {
  const user = await prisma.user.findUnique({
    where: { userId },
    select: { email: true, totpSecret: true, totpEnabled: true },
  });
  if (!user) throw new AppError(404, "UserNotFound");
  if (user.totpEnabled) throw new AppError(400, "AlreadyEnrolled");

  // Reuse pending secret if mid-enrolment; otherwise mint fresh.
  const secret = user.totpSecret ?? generateSecret();
  if (!user.totpSecret) {
    await prisma.user.update({
      where: { userId },
      data: { totpSecret: secret },
    });
  }
  return { secret, otpauthUri: buildOtpauthUri(user.email, secret) };
}

/**
 * POST /auth/totp/enroll-verify. First authenticator code confirms
 * the secret and flips totpEnabled=true.
 */
export async function totpEnrollVerify(
  userId: number,
  code: string,
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { userId },
    select: { totpSecret: true, totpEnabled: true },
  });
  if (!user) throw new AppError(404, "UserNotFound");
  if (user.totpEnabled) throw new AppError(400, "AlreadyEnrolled");
  if (!user.totpSecret) throw new AppError(400, "NoEnrollmentInProgress");
  const ok = await verifyTotpCode(code, user.totpSecret);
  if (!ok) throw new AppError(400, "InvalidTotp");
  await prisma.user.update({
    where: { userId },
    data: { totpEnabled: true },
  });
  await audit({
    actorId: userId,
    action: "user.totp_enabled",
    targetType: "user",
    targetId: userId,
  });
}

/**
 * POST /auth/totp/disable. Requires the user's current password
 * (not a TOTP code) so a stolen session alone can't turn 2FA off.
 */
export async function totpDisable(
  userId: number,
  password: string,
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { userId },
    select: { password: true, totpEnabled: true },
  });
  if (!user) throw new AppError(404, "UserNotFound");
  if (!user.totpEnabled) return;
  if (!user.password) throw new AppError(400, "NoPasswordSet");
  const ok = await bcrypt.compare(password, user.password);
  if (!ok) throw new AppError(401, "InvalidPassword");

  await prisma.user.update({
    where: { userId },
    data: { totpEnabled: false, totpSecret: null },
  });
  await audit({
    actorId: userId,
    action: "user.totp_disabled",
    targetType: "user",
    targetId: userId,
  });
}

/**
 * TOTP step-up. Verifies a fresh code and stamps Session.lastTotpAt
 * so requireRecent2FA lets the user proceed with the sensitive action.
 */
export async function totpStepUp(
  userId: number,
  sessionId: number | null,
  code: string,
): Promise<void> {
  if (sessionId === null) {
    throw new AppError(
      401,
      "NoSession",
      "Step-up requires a better-auth session. Sign out and sign back in to refresh.",
    );
  }
  const user = await prisma.user.findUnique({
    where: { userId },
    select: { totpEnabled: true, totpSecret: true },
  });
  if (!user) throw new AppError(404, "UserNotFound");
  if (!user.totpEnabled || !user.totpSecret) {
    throw new AppError(
      400,
      "NotEnrolled",
      "TOTP isn't enabled on this account.",
    );
  }
  const ok = await verifyTotpCode(code, user.totpSecret);
  if (!ok) throw new AppError(400, "InvalidTotp");
  await prisma.session.update({
    where: { id: sessionId },
    data: { lastTotpAt: new Date() },
  });
  await audit({
    actorId: userId,
    action: "auth.totp.step_up",
    targetType: "session",
    targetId: sessionId,
  });
}

/**
 * List the user's social-login Account rows. Excludes the credential
 * row. For Google, accountId is the OAuth `sub` claim, not the email.
 */
export async function listConnectedAccounts(
  userId: number,
): Promise<
  Array<{
    provider: string;
    accountRef: string;
    linkedAt: Date;
  }>
> {
  const rows = await prisma.account.findMany({
    where: { userId, NOT: { providerId: "credential" } },
    select: { providerId: true, accountId: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((r) => ({
    provider: r.providerId,
    accountRef: r.accountId,
    linkedAt: r.createdAt,
  }));
}

/**
 * Remove the Google account row(s). Refuses with PasswordNotSet
 * when no credential password exists - would lock the user out.
 */
export async function unlinkGoogle(userId: number): Promise<void> {
  const credential = await prisma.account.findFirst({
    where: {
      userId,
      providerId: "credential",
      password: { not: null },
    },
    select: { id: true },
  });
  if (!credential) {
    throw new AppError(
      400,
      "PasswordNotSet",
      "Set a password before unlinking Google - otherwise you'll be locked out.",
    );
  }
  const result = await prisma.account.deleteMany({
    where: { userId, providerId: "google" },
  });
  if (result.count === 0) {
    throw new AppError(404, "NotLinked", "No Google account is linked.");
  }
  await audit({
    actorId: userId,
    action: "auth.unlink.google",
    targetType: "account",
    targetId: userId,
  });
}
