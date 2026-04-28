import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import type { UserRole } from "@prisma/client";
import { prisma } from "../db/prisma.js";
import { AppError } from "../utils/errors.js";
import { findFirstProfaneField } from "../utils/profanity.js";
import { sendEmail } from "../utils/email.js";
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

/**
 * Strip the bcrypt hash before any user object crosses the network.
 * Single source of truth — every controller that returns a user
 * passes the row through this.
 */
function sanitize(user: any): SafeUser {
  if (!user) return user;
  const { password, ...safe } = user;
  return safe as SafeUser;
}

/**
 * Hashing cost — 10 rounds matches the legacy Next route. Higher
 * costs (12+) feel safer but add ~250 ms per login on the demo Fly
 * machine, which is more than the rest of the request combined.
 */
const BCRYPT_ROUNDS = 10;

export interface AuthOutcome {
  user: SafeUser;
  role: UserRole;
}

/**
 * Login — verifies credentials, side-effects an active cart row if
 * the user doesn't have one yet (a demo convenience inherited from
 * the BFF route), throws `AppError(401)` for ANY failure mode so
 * callers can't distinguish "wrong email" from "wrong password" or
 * "soft-deleted account" — keeps the response surface flat to
 * attackers.
 */
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
  // Phase 14.1 — User.password is nullable now (Google-only signups
  // have no password until they Set Password from /profile/edit).
  // Treat NULL the same as a wrong password — same surface, no
  // information leak about WHY the credential check failed.
  if (!user.password) throw new AppError(401, "InvalidCredentials");
  const ok = await bcrypt.compare(input.password, user.password);
  if (!ok) throw new AppError(401, "InvalidCredentials");

  // Background-create active cart if missing — fire-and-forget so
  // the login response isn't blocked on it.
  if (user.carts.length === 0) {
    void prisma.cart
      .create({ data: { userId: user.userId, status: "active" } })
      .catch(() => {});
  }

  const role = (user.stats?.role ?? "buyer") as UserRole;
  return { user: sanitize(user), role };
}

/**
 * Register — runs the profanity gate (same dictionary as Phase 11/F3)
 * BEFORE the duplicate check + DB write so a banned name never
 * pollutes Neon. Throws:
 *   • 400 ProfanityRejected  — slur in username / first / last name
 *   • 409 Conflict           — duplicate username or email
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
      // dateOfBirth comes in YYYY-MM-DD; pin to UTC midnight so the
      // value doesn't shift across timezones in the DB.
      dateOfBirth: input.dateOfBirth
        ? new Date(`${input.dateOfBirth}T00:00:00.000Z`)
        : undefined,
      password: hash,
      stats: { create: { role: "buyer" } },
      carts: { create: { status: "active" } },
    },
    include: { stats: true },
  });

  return { user: sanitize(user), role: (user.stats?.role ?? "buyer") as UserRole };
}

/**
 * Resolve the user behind a given userId — used by GET /auth/me
 * after the auth middleware has decoded the cookie. Returns `null`
 * when the row is missing or soft-deleted (signals "session is
 * stale, log out").
 */
export async function getById(userId: number): Promise<SafeUser | null> {
  const user = await prisma.user.findUnique({
    where: { userId },
    include: { stats: true, store: true },
  });
  if (!user || user.deletedAt) return null;
  return sanitize(user);
}

/**
 * PATCH /auth/me — same profanity gate as register, plus an email
 * uniqueness check (only if the email actually changed — saves a
 * query on every save).
 */
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
  return sanitize(updated);
}

/**
 * POST /auth/change-password — requires the current password to be
 * correct (so a stolen session token can't pivot the account
 * password without the old one).
 */
export async function changePassword(
  userId: number,
  input: ChangePasswordInput,
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { userId },
    // Phase 15.3 — pull phone + phoneVerifiedAt so we know whether
    // to gate on a fresh OTP (only when the user has actually
    // verified their phone).
    select: { password: true, phone: true, phoneVerifiedAt: true },
  });
  if (!user) throw new AppError(404, "UserNotFound");
  // Phase 14.1 — Google-only users have no password set. They must
  // use the Phase 14.3 `POST /auth/set-password` flow first (which
  // skips currentPassword verification because there is none yet).
  if (!user.password) throw new AppError(400, "NoPasswordSet");

  const ok = await bcrypt.compare(input.currentPassword, user.password);
  if (!ok) throw new AppError(401, "InvalidCurrentPassword");

  // Phase 15.3 — when phone is verified, sensitive password change
  // requires a fresh OTP. Defends against a stolen session: an
  // attacker with a valid cookie can't change the password without
  // also having access to the user's SMS messages.
  await ensureSensitiveOtpIfVerified(userId, user.phone, user.phoneVerifiedAt, input.otpCode);

  const hash = await bcrypt.hash(input.newPassword, BCRYPT_ROUNDS);
  await prisma.user.update({
    where: { userId },
    data: { password: hash },
  });
}

/**
 * POST /auth/set-password — Phase 14.3.
 *
 * First-time password set for OAuth-only users (User.password is
 * NULL because they signed up via Google). No `currentPassword`
 * required — there is none. Once set, the user can sign in via
 * either Google OR email+password from then on.
 *
 * Refuses (400 PasswordAlreadySet) if the user already has a
 * password — those calls should go through changePassword instead,
 * which protects the password-change with the existing-password
 * check.
 *
 * Audit row written so admins can see when a Google-only account
 * promoted to a hybrid (Google + password) account.
 */
export async function setPassword(
  userId: number,
  input: SetPasswordInput,
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { userId },
    // Phase 15.3 — same OTP-gating story as changePassword. A user
    // who set a phone + verified it before clicking 'Set password'
    // proves possession via fresh OTP.
    select: { password: true, phone: true, phoneVerifiedAt: true },
  });
  if (!user) throw new AppError(404, "UserNotFound");
  if (user.password) throw new AppError(400, "PasswordAlreadySet");

  await ensureSensitiveOtpIfVerified(userId, user.phone, user.phoneVerifiedAt, input.otpCode);

  const hash = await bcrypt.hash(input.newPassword, BCRYPT_ROUNDS);
  await prisma.user.update({
    where: { userId },
    data: { password: hash },
  });
  await audit({
    actorId: userId,
    action: "user.set_password",
    targetType: "user",
    targetId: userId,
  });
}

// =============================================================================
//  PHASE 15.3 — OTP enforcement helper
// =============================================================================

/**
 * Phase 15.3 — gate sensitive password operations on a fresh OTP
 * when the user has verified their phone. No-op when phone isn't
 * verified (Phase 14.4's scaffold is opt-in; users who haven't
 * verified can still change passwords with just their current one).
 *
 * Failure modes (all 400 with distinct error codes):
 *   • OtpRequired       — phone is verified but no code in body
 *   • InvalidOtp        — code didn't match the pending hash
 *   • NoPendingOtp      — no /request-otp was called recently
 *   • OtpExpired        — pending code is past TTL
 *
 * Consumes the verification row on success — exactly the same
 * behaviour as the standalone /auth/verify-otp endpoint, just
 * inline so /change-password and /set-password can require a
 * single round-trip.
 */
async function ensureSensitiveOtpIfVerified(
  userId: number,
  phone: string | null,
  phoneVerifiedAt: Date | null,
  otpCode: string | undefined,
): Promise<void> {
  // No phone OR not verified → OTP not required. Bail early.
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

  // Consume the row so the same code can't be replayed against a
  // second sensitive action.
  await prisma.verification.delete({ where: { id: pending.id } });
}

// =============================================================================
//  PHASE 14.4 — phone + OTP scaffold
// =============================================================================

/**
 * PATCH /auth/phone — set/update the user's phone number.
 *
 * Clears phoneVerifiedAt because the new number hasn't been verified
 * yet. Strips non-digits + leading + before storage so the value is
 * normalised and OTP delivery doesn't choke on stray whitespace.
 *
 * Doesn't auto-trigger OTP delivery — the caller hits POST
 * /auth/request-otp explicitly. Two-step flow keeps the cost
 * boundary (Twilio SMS credits) in the user's hands.
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
 * POST /auth/request-otp — issue a 6-digit code to the user's phone.
 *
 * Reads User.phone (set via PATCH /auth/phone). Returns 400
 * NoPhoneOnFile if missing. Wipes any pending code for the same
 * user before inserting a new one (so the latest code always wins;
 * stops attackers replaying a stale code if they intercept it).
 *
 * Returns the transport name so the dev/demo flow can show "Code
 * was logged to console" vs "Code was SMS-ed". Production stays
 * silent on transport (server logs cover the audit need).
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

  // Wipe any pending code for this user (only one active OTP at a
  // time). deleteMany so an absent row doesn't throw.
  await prisma.verification.deleteMany({ where: { identifier } });
  await prisma.verification.create({
    data: { identifier, value: hash, expiresAt: otpExpiresAt() },
  });

  // Fire delivery; surface failures as 502 so the client knows the
  // code didn't actually go out (not the user's fault).
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
 * POST /auth/verify-otp — consume the pending code and set
 * phoneVerifiedAt.
 *
 * Failure modes (all 400 with distinct error codes so the UI can
 * surface helpful messages):
 *   • NoPendingOtp — user never requested or it expired+swept
 *   • OtpExpired — found one but past TTL (5 min)
 *   • InvalidOtp — hash mismatch (wrong code or wrong phone)
 *
 * Always deletes the verification row on a successful verify so
 * a code can't be replayed.
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
    // Sweep the stale row so the next request gets a clean slate.
    await prisma.verification.delete({ where: { id: pending.id } });
    throw new AppError(400, "OtpExpired");
  }

  const expected = hashCode(userId, user.phone, input.code);
  if (expected !== pending.value) {
    throw new AppError(400, "InvalidOtp");
  }

  // Atomic: mark phone verified + drop the pending row in one tx.
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
    meta: { phone: user.phone.slice(-4) }, // last 4 digits only — PII
  });
}

// =============================================================================
//  PHASE 15.2 — sessions UI (better-auth's session table)
// =============================================================================
//
// Phase 14.2's dual-stack means the User has two paths to be signed
// in: our hand-rolled JWT cookie OR better-auth's session row in
// the `session` table. The Sessions UI only manages the latter
// (the JWT cookie can be revoked just by changing the password,
// since requireAuth re-verifies on every request).

/**
 * GET /auth/sessions — list every active better-auth session for the
 * current user. Ordered most-recent-first. Strips the bcrypt-style
 * `token` field — even hashed it's user-secret, no UI need surfaces
 * it (we identify rows by integer id).
 */
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

/**
 * DELETE /auth/sessions/:id — revoke one session. Ownership check
 * via the userId predicate so a malicious user can't enumerate +
 * delete other users' sessions by guessing IDs.
 */
export async function revokeSession(userId: number, sessionId: number): Promise<void> {
  const result = await prisma.session.deleteMany({
    where: { id: sessionId, userId },
  });
  if (result.count === 0) throw new AppError(404, "SessionNotFound");
}

/**
 * DELETE /auth/sessions/all-others — revoke every session for the
 * user EXCEPT the current one. The "current" sessionId comes from
 * the controller (which has access to auth.api.getSession headers).
 *
 * If currentSessionId is null (the user is logged in via the legacy
 * JWT cookie, not better-auth), this revokes ALL better-auth sessions
 * unconditionally — useful for a user who wants to nuke everything
 * after a Google sign-in scare.
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

const RESET_TOKEN_TTL_MIN = 30;

/**
 * POST /auth/forgot-password — issue a password reset token + email
 * the link.
 *
 * Always succeeds (return value is meaningless to the controller —
 * never expose whether the email was found, otherwise an attacker
 * can enumerate registered accounts). Soft-deleted users get the
 * same silent treatment.
 *
 * The raw token goes into the email link; we store its SHA-256 hash
 * in the DB so a leaked DB row alone can't reset anyone's password.
 * TTL: 30 minutes (matches the BFF behaviour the email asks for).
 */
export async function forgotPassword(input: ForgotPasswordInput): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user || user.deletedAt) return; // silent no-op

  const raw = crypto.randomBytes(32).toString("base64url");
  const tokenHash = crypto.createHash("sha256").update(raw).digest("hex");
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MIN * 60_000);

  await prisma.passwordResetToken.create({
    data: { userId: user.userId, tokenHash, expiresAt },
  });

  // Link points at the BFF, not the API server — that's where the
  // user-facing /reset-password page lives. SITE_URL falls back to
  // the prod URL so the email is always actionable.
  const base = process.env.SITE_URL ?? "https://metu.fly.dev";
  const link = `${base}/reset-password?token=${raw}`;

  await sendEmail({
    to: user.email,
    subject: "Reset your METU password",
    html: `
      <p>Hi ${user.firstName ?? ""},</p>
      <p>Use the link below to set a new password. It expires in ${RESET_TOKEN_TTL_MIN} minutes.</p>
      <p><a href="${link}">${link}</a></p>
      <p>If you didn't request this, ignore this email — your password stays the same.</p>
      <p>— The METU team</p>
    `,
  });
}

/**
 * POST /auth/reset-password — consume a valid token + write a new
 * bcrypt hash. We hash the raw token client-side then look up by
 * the hash. The hashed lookup means a leaked DB row alone can't
 * reset anyone's password.
 *
 * Throws `AppError(400, "InvalidToken")` for any rejection mode
 * (missing / consumed / expired) so an attacker can't tell which
 * branch they hit.
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

  // Three-statement transaction:
  //  1. Update the user's password.
  //  2. Mark the consumed token (this token can't be reused).
  //  3. Invalidate any OTHER outstanding tokens for the same user
  //     so an attacker who grabbed a separate fresh token (e.g.
  //     before this reset) can't use it after the password rotates.
  await prisma.$transaction([
    prisma.user.update({ where: { userId: row.userId }, data: { password: hash } }),
    prisma.passwordResetToken.update({
      where: { tokenId: row.tokenId },
      data: { consumedAt: new Date() },
    }),
    prisma.passwordResetToken.updateMany({
      where: { userId: row.userId, consumedAt: null, NOT: { tokenId: row.tokenId } },
      data: { consumedAt: new Date() },
    }),
  ]);

  await audit({
    actorId: row.userId,
    action: "auth.password_reset",
    targetType: "user",
    targetId: row.userId,
  });
}
