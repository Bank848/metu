import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { Prisma, type UserRole } from "@prisma/client";
import { prisma } from "../db/prisma.js";
import { AppError } from "../utils/errors.js";
import { findFirstProfaneField } from "../utils/profanity.js";
import { sendEmail } from "../utils/email.js";
import { renderEmailLayout, escapeHtml } from "../utils/email-template.js";
import { audit } from "../utils/audit.js";
import { normalizeThaiPhone, isValidThaiE164 } from "../utils/phone.js";
import { SITE_URL, DEMO_REVEAL_TOKENS } from "../config.js";
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
import {
  buildOtpauthUri,
  canonicalBackupCode,
  generateSecret,
  hashBackupCode,
  mintBackupCodes,
  verifyCode as verifyTotpCode,
} from "../utils/totp.js";

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
  /**
   * only populated by `register()` when DEMO_REVEAL_TOKENS=true.
   * Carries the raw OTP + email-verify token so the BFF can stamp them
   * into the verify-page demo banner.
   */
  demo?: {
    otp?: string;
    emailToken?: string;
  };
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
  if (!user) {
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

  // verification gates. Run AFTER password+TOTP so we
  // don't leak which step failed. The frontend uses these distinct
  // codes to bounce the user to the right verify page.
  if (!user.emailVerified) {
    throw new AppError(403, "EmailNotVerified", "Confirm your email to finish signing in.");
  }
  if (!user.phoneVerifiedAt) {
    throw new AppError(403, "PhoneNotVerified", "Verify your phone to finish signing in.");
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
  if (dupUsername) {
    throw new AppError(409, "UsernameTaken", "That username is already taken. Pick another.");
  }
  if (dupEmail) {
    throw new AppError(
      409,
      "EmailTaken",
      "An account with that email already exists. Sign in with your password or use \"Forgot password\".",
    );
  }

  // Normalise phone to E.164 BEFORE persisting so the firebase SMS
  // cross-account guard (`gateFirebaseSmsRequest`) can do an exact
  // string match. Earlier rev stored the raw input — an attacker
  // could register one phone in three formats (`+66812345678`,
  // `66812345678`, `0812345678`) across three accounts and bypass
  // the per-phone cooldown, SMS-bombing the victim 5 times faster.
  // Returns null if the input is not a valid Thai number; we keep
  // the (validated by zod) input as a fallback so register doesn't
  // 500 on edge inputs the regex passed.
  const normalizedPhone = normalizeThaiPhone(input.phone) ?? input.phone;

  const hash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
  // wrap create in try/catch for the race where two
  // concurrent registers slip past the dup pre-check above. The DB
  // unique constraint catches it, we map P2002 to a clean 409 instead
  // of bubbling up as a 500.
  let user: Prisma.UserGetPayload<{ include: { stats: true } }>;
  try {
    user = await prisma.user.create({
      data: {
        username: input.username,
        email: input.email,
        firstName: input.firstName,
        lastName: input.lastName,
        countryId: input.countryId,
        gender: input.gender,
        phone: normalizedPhone,
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
  } catch (err) {
    // Prisma surfaces the offending fields in `meta.target`.
    const isP2002 =
      err && typeof err === "object" && (err as { code?: string }).code === "P2002";
    if (isP2002) {
      const target = (err as { meta?: { target?: string[] } }).meta?.target ?? [];
      if (target.includes("username")) {
        throw new AppError(409, "UsernameTaken", "That username is already taken. Pick another.");
      }
      if (target.includes("email")) {
        throw new AppError(
          409,
          "EmailTaken",
          'An account with that email already exists. Sign in with your password or use "Forgot password".',
        );
      }
      throw new AppError(409, "Conflict", "Account already exists.");
    }
    throw err;
  }

  await syncCredentialAccount(user.userId, user.email, hash);

  // mandatory verify flow. Email link goes to inbox; phone
  // OTP goes to console (real SMS would replace logPhoneOtp).
  const [rawEmailToken, otp] = await Promise.all([
    issueEmailVerifyToken(user.userId),
    issuePhoneOtp(user.userId),
  ]);
  await sendEmailVerifyMessage(user.email, user.firstName, rawEmailToken).catch((err) => {
    // eslint-disable-next-line no-console
    console.error("[register] email verify send failed:", err);
  });
  logPhoneOtp(input.phone, otp);

  await audit({
    actorId: user.userId,
    action: "user.register",
    targetType: "user",
    targetId: user.userId,
    meta: { email: user.email },
  });

  // demo escape hatch. When DEMO_REVEAL_TOKENS=true, the
  // raw OTP and email-verify token come back in the response so the
  // BFF can surface them on the verify pages. The Resend sandbox
  // sender only delivers email to the account owner and SMS isn't
  // wired to a real provider, so without this escape hatch a fresh
  // demo register has no way to read the values.
  const demo =
    DEMO_REVEAL_TOKENS
      ? { otp, emailToken: rawEmailToken }
      : undefined;
  return {
    user: sanitize(user),
    role: (user.stats?.role ?? "buyer") as UserRole,
    ...(demo ? { demo } : {}),
  };
}

/**
 * confirm an email-verify token from the URL. One-shot:
 * the token row gets consumedAt stamped on success.
 */
export async function verifyEmail(token: string): Promise<void> {
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const row = await prisma.emailVerifyToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });
  if (!row || row.consumedAt || row.expiresAt < new Date()) {
    throw new AppError(400, "InvalidToken", "Verify link is invalid or expired.");
  }
  await prisma.$transaction([
    prisma.user.update({
      where: { userId: row.userId },
      data: { emailVerified: true },
    }),
    prisma.emailVerifyToken.update({
      where: { tokenId: row.tokenId },
      data: { consumedAt: new Date() },
    }),
  ]);
  await audit({
    actorId: row.userId,
    action: "user.email_verified",
    targetType: "user",
    targetId: row.userId,
  });
}

/**
 * resend the email-verify link. Quietly succeeds if the
 * email is already verified or doesn't exist (no enumeration).
 */
export async function resendEmailVerify(
  email: string,
): Promise<{ demo?: { emailToken: string } }> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.emailVerified) return {};
  const raw = await issueEmailVerifyToken(user.userId);
  await sendEmailVerifyMessage(user.email, user.firstName, raw);
  return DEMO_REVEAL_TOKENS
    ? { demo: { emailToken: raw } }
    : {};
}

/**
 * verify the 6-digit OTP entered after register. Email
 * is the lookup key (no session yet at this stage).
 */
export async function verifyPhoneRegister(email: string, code: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email } });
  // collapse all failure modes to one InvalidCode error.
  // Distinct errors (UserNotFound vs NoPendingOtp vs OtpExpired) leak
  // whether an email is registered + whether they recently signed up.
  const GENERIC = new AppError(401, "InvalidCode", "OTP didn't match. Request a new one if needed.");
  if (!user) throw GENERIC;
  if (user.phoneVerifiedAt) return; // already verified
  if (!user.phoneOtpHash || !user.phoneOtpExpiresAt) throw GENERIC;
  if (user.phoneOtpExpiresAt < new Date()) {
    // Clear the expired OTP so it can't be retried.
    await prisma.user.update({
      where: { userId: user.userId },
      data: { phoneOtpHash: null, phoneOtpExpiresAt: null },
    });
    throw GENERIC;
  }
  const hash = crypto.createHash("sha256").update(code).digest("hex");
  if (hash !== user.phoneOtpHash) {
    // Brute-force guard: shorten TTL on each wrong guess; after ~5
    // attempts the OTP auto-expires and the user must re-request.
    const remaining = user.phoneOtpExpiresAt.getTime() - Date.now();
    const penalty = 2 * 60_000;
    if (remaining <= penalty) {
      await prisma.user.update({
        where: { userId: user.userId },
        data: { phoneOtpHash: null, phoneOtpExpiresAt: null },
      });
    } else {
      await prisma.user.update({
        where: { userId: user.userId },
        data: { phoneOtpExpiresAt: new Date(Date.now() + remaining - penalty) },
      });
    }
    throw GENERIC;
  }
  await prisma.user.update({
    where: { userId: user.userId },
    data: {
      phoneVerifiedAt: new Date(),
      phoneOtpHash: null,
      phoneOtpExpiresAt: null,
    },
  });
  await audit({
    actorId: user.userId,
    action: "user.phone_verified",
    targetType: "user",
    targetId: user.userId,
  });
}

/**
 * Server-side gate that the client must call BEFORE asking Firebase to
 * send an SMS. Firebase Phone Auth fires SMS client-direct (browser →
 * Firebase Auth servers), so without this gate an attacker who clears
 * localStorage / opens incognito / scripts the Firebase SDK can burn our
 * Blaze billing at $0.01 per text. We enforce three orthogonal limits
 * against the audit log:
 *
 *   - per-user 5-minute cooldown (one buyer can't loop the same email)
 *   - per-user 5/hour cap (then forced 1-hour timeout)
 *   - per-phone 2-minute cross-account cooldown (anti-bombing — one
 *     phone number can't receive SMS triggered by 50 different fake
 *     emails in a row)
 *
 * Returns OK or throws 429 with retryAfterSec in the message.
 */
const SMS_COOLDOWN_MS = 5 * 60_000;
const SMS_HOURLY_CAP = 5;
const SMS_HOURLY_WINDOW_MS = 60 * 60_000;
const SMS_HOURLY_LOCKOUT_MS = 60 * 60_000;
const SMS_PHONE_COOLDOWN_MS = 2 * 60_000;

export async function gateFirebaseSmsRequest(email: string): Promise<{ ok: true }> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { userId: true, phone: true, phoneVerifiedAt: true },
  });
  if (!user) {
    // Quiet refusal — don't leak whether the email is registered. Pretend
    // the rate-limit hit so a probe can't enumerate accounts.
    throw new AppError(429, "RateLimited", "Wait a few minutes before requesting another code.");
  }
  // Already verified — no SMS needed at all.
  if (user.phoneVerifiedAt) {
    throw new AppError(400, "AlreadyVerified", "This phone is already verified.");
  }

  const now = Date.now();
  // Per-user attempts in the last hour.
  const userRecent = await prisma.auditLog.findMany({
    where: {
      action: "phone.firebase_sms.requested",
      targetType: "user",
      targetId: user.userId,
      createdAt: { gte: new Date(now - SMS_HOURLY_WINDOW_MS) },
    },
    select: { createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  // 5/hour cap → 1-hour lockout from the OLDEST attempt in window.
  if (userRecent.length >= SMS_HOURLY_CAP) {
    const oldest = userRecent[userRecent.length - 1].createdAt.getTime();
    const retryAt = oldest + SMS_HOURLY_LOCKOUT_MS;
    const retryAfterSec = Math.max(1, Math.ceil((retryAt - now) / 1000));
    throw new AppError(
      429,
      "RateLimited",
      `Too many SMS requests. Try again in ${Math.ceil(retryAfterSec / 60)} minutes.`,
    );
  }

  // 5-minute cooldown between consecutive sends.
  if (userRecent.length > 0) {
    const lastAt = userRecent[0].createdAt.getTime();
    const allowedAt = lastAt + SMS_COOLDOWN_MS;
    if (now < allowedAt) {
      const retryAfterSec = Math.max(1, Math.ceil((allowedAt - now) / 1000));
      throw new AppError(
        429,
        "RateLimited",
        `Wait ${retryAfterSec >= 60 ? `${Math.ceil(retryAfterSec / 60)} min` : `${retryAfterSec}s`} before requesting another code.`,
      );
    }
  }

  // Cross-account phone cooldown — block the same phone from being
  // bombed via re-registration loops. We look at audit metadata for
  // `phone` and refuse if any account texted this number recently.
  if (user.phone) {
    const phoneRecent = await prisma.auditLog.findFirst({
      where: {
        action: "phone.firebase_sms.requested",
        meta: { path: ["phone"], equals: user.phone },
        createdAt: { gte: new Date(now - SMS_PHONE_COOLDOWN_MS) },
      },
      select: { logId: true, targetId: true },
    });
    if (phoneRecent && phoneRecent.targetId !== user.userId) {
      throw new AppError(
        429,
        "RateLimited",
        "This phone number was just texted from another account. Wait a couple of minutes.",
      );
    }
  }

  // Pass — record the attempt so subsequent calls see this one.
  await audit({
    actorId: user.userId,
    action: "phone.firebase_sms.requested",
    targetType: "user",
    targetId: user.userId,
    meta: user.phone ? { phone: user.phone } : null,
  });

  return { ok: true };
}

/**
 * Same Firebase phone verify but lookups by email so the post-register
 * page can call it before a session exists. Anti-abuse: Firebase token
 * proves SMS delivery, the email lookup proves which account.
 */
export async function verifyPhoneFirebaseByEmail(
  email: string,
  idToken: string,
): Promise<{ phone: string; phoneVerifiedAt: Date }> {
  const { verifyFirebaseIdToken } = await import("../lib/firebase-admin.js");
  const decoded = await verifyFirebaseIdToken(idToken);
  const firebasePhone = decoded.phone_number;
  if (!firebasePhone) {
    throw new AppError(
      400,
      "FirebaseTokenMissingPhone",
      "Firebase token did not include a phone number. Try resending the SMS.",
    );
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { userId: true, phone: true, phoneVerifiedAt: true },
  });
  // Quiet 200 if the email doesn't exist — avoids confirming whether
  // an account is registered to whoever holds the Firebase token.
  if (!user) {
    return { phone: firebasePhone, phoneVerifiedAt: new Date() };
  }
  if (user.phoneVerifiedAt && user.phone === firebasePhone) {
    return { phone: user.phone, phoneVerifiedAt: user.phoneVerifiedAt };
  }

  const updated = await prisma.user.update({
    where: { userId: user.userId },
    data: {
      phone: firebasePhone,
      phoneVerifiedAt: new Date(),
      phoneOtpHash: null,
      phoneOtpExpiresAt: null,
    },
    select: { phone: true, phoneVerifiedAt: true },
  });
  await audit({
    actorId: user.userId,
    action: "user.phone_verified",
    targetType: "user",
    targetId: user.userId,
    meta: { method: "firebase-by-email" },
  });
  return {
    phone: updated.phone!,
    phoneVerifiedAt: updated.phoneVerifiedAt!,
  };
}

/**
 * verify a Firebase Phone Auth ID token + stamp the user's
 * `phoneVerifiedAt`. Used as an alternative to our home-grown OTP
 * flow when the user opts to verify with SMS via Firebase (10 free
 * SMS/day at the time of writing).
 * The client SDK takes the user through reCAPTCHA + SMS, then hands
 * back an ID token containing `phone_number`. We verify the token
 * server-side, confirm the phone matches what we have on file (or
 * just adopt it if the user didn't have one yet), and stamp
 * `phoneVerifiedAt`. Idempotent — already-verified users return
 * 200 with no change.
 */
export async function verifyPhoneFirebase(
  userId: number,
  idToken: string,
): Promise<{ phone: string; phoneVerifiedAt: Date }> {
  // Lazy-import so unconfigured envs don't crash module load. Phase 46
  // landing without Firebase secrets keeps the API healthy; only the
  // route that calls this service surfaces the 503.
  const { verifyFirebaseIdToken } = await import("../lib/firebase-admin.js");
  const decoded = await verifyFirebaseIdToken(idToken);
  const firebasePhone = decoded.phone_number; // e.g. "+66812345678"
  if (!firebasePhone) {
    throw new AppError(
      400,
      "FirebaseTokenMissingPhone",
      "Firebase token did not include a phone number — try the OTP again.",
    );
  }

  const user = await prisma.user.findUnique({
    where: { userId },
    select: { phone: true, phoneVerifiedAt: true },
  });
  if (!user) throw new AppError(404, "UserNotFound");
  if (user.phoneVerifiedAt && user.phone === firebasePhone) {
    return { phone: user.phone, phoneVerifiedAt: user.phoneVerifiedAt };
  }

  const updated = await prisma.user.update({
    where: { userId },
    data: {
      phone: firebasePhone,
      phoneVerifiedAt: new Date(),
      // Clear any pending in-house OTP so the two flows can't conflict.
      phoneOtpHash: null,
      phoneOtpExpiresAt: null,
    },
    select: { phone: true, phoneVerifiedAt: true },
  });
  await audit({
    actorId: userId,
    action: "user.phone_verified",
    targetType: "user",
    targetId: userId,
    meta: { method: "firebase" },
  });
  return {
    phone: updated.phone!,
    phoneVerifiedAt: updated.phoneVerifiedAt!,
  };
}

/**
 * resend a fresh OTP after register (e.g. user closed the
 * verify page or the code expired). Quietly succeeds if user is
 * already verified or doesn't exist.
 */
export async function resendPhoneOtp(
  email: string,
): Promise<{ demo?: { otp: string } }> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.phoneVerifiedAt) return {};
  if (!user.phone) return {};
  // cooldown: if the existing OTP still has >8 min left
  // (issued <2 min ago), don't re-issue. Prevents SMS/email spam.
  if (user.phoneOtpExpiresAt) {
    const remaining = user.phoneOtpExpiresAt.getTime() - Date.now();
    const COOLDOWN_MS = 2 * 60_000; // 2-minute cooldown
    const FULL_TTL_MS = PHONE_OTP_TTL_MIN * 60_000;
    if (remaining > FULL_TTL_MS - COOLDOWN_MS) {
      return {}; // silently refuse — too soon
    }
  }
  const otp = await issuePhoneOtp(user.userId);
  logPhoneOtp(user.phone, otp);
  return DEMO_REVEAL_TOKENS ? { demo: { otp } } : {};
}

// GET /auth/me. Returns null for missing users.
export async function getById(userId: number): Promise<SafeUser | null> {
  const user = await prisma.user.findUnique({
    where: { userId },
    include: { stats: true, store: true },
  });
  if (!user) return null;
  return sanitize(user);
}

// PATCH /auth/me. Profanity gate + email/phone change requires the
// new dedicated start/verify flows (sensitive_change_otp_*) — they
// can no longer slip through this generic update.
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
  // Email + phone changes require an OTP-confirmed flow so a stolen
  // session can't trivially hijack the account by swapping recovery
  // contact info. Use POST /auth/me/email-change/{start,verify} and
  // POST /auth/me/phone-change/{start,verify} instead.
  if (input.email && input.email !== currentEmail) {
    throw new AppError(
      400,
      "UseEmailChangeFlow",
      "Email changes require OTP confirmation. Use the Change email button.",
    );
  }

  const data: Record<string, unknown> = {};
  if (input.firstName !== undefined) data.firstName = input.firstName;
  if (input.lastName !== undefined) data.lastName = input.lastName;
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

// =============================================================================
//  SENSITIVE CHANGE FLOWS — email + phone
// =============================================================================
//
// Both flows: send a 6-digit OTP to the user's CURRENT email (proof the
// session belongs to the rightful owner), then on verify apply the new
// value. Phone changes also re-set phoneVerifiedAt to NULL so the buyer
// goes through normal phone OTP for the NEW number on next sign-in.
//
// We piggy-back on the User.phoneOtpHash + phoneOtpExpiresAt columns —
// they're already there for the register-time phone OTP and these
// changes happen post-register so there's no collision risk.

const SENSITIVE_OTP_LIFETIME_MS = 10 * 60_000;

async function issueSensitiveOtp(userId: number, email: string, intent: "email" | "phone", target: string): Promise<void> {
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
  const hash = crypto.createHash("sha256").update(`${intent}:${target}:${code}`).digest("hex");
  await prisma.user.update({
    where: { userId },
    data: {
      phoneOtpHash: hash,
      phoneOtpExpiresAt: new Date(Date.now() + SENSITIVE_OTP_LIFETIME_MS),
    },
  });
  const subject = intent === "email"
    ? `METU email change confirmation — ${code}`
    : `METU phone change confirmation — ${code}`;
  const heading = intent === "email" ? "Confirm your email change" : "Confirm your phone change";
  const intro = intent === "email"
    ? `You asked to change your METU email to <strong>${escapeHtml(target)}</strong>. Enter the 6-digit code below to confirm. If this wasn't you, change your password immediately.`
    : `You asked to change your METU phone to <strong>${escapeHtml(target)}</strong>. Enter the 6-digit code below to confirm. If this wasn't you, change your password immediately.`;
  const body = renderEmailLayout({
    heading,
    intro,
    bodyHtml: `<p style="text-align:center;font-family:monospace;font-size:32px;letter-spacing:8px;color:#facc15;font-weight:bold;margin:24px 0;">${code}</p><p style="text-align:center;color:#94a3b8;font-size:13px;margin:0;">Expires in 10 minutes.</p>`,
  });
  await sendEmail({ to: email, subject, html: body }).catch((err) => {
    // eslint-disable-next-line no-console
    console.error("[sensitive-otp] email send failed:", err);
  });
}

function verifySensitiveOtp(stored: { phoneOtpHash: string | null; phoneOtpExpiresAt: Date | null }, intent: "email" | "phone", target: string, code: string): boolean {
  if (!stored.phoneOtpHash || !stored.phoneOtpExpiresAt) return false;
  if (stored.phoneOtpExpiresAt < new Date()) return false;
  const expected = crypto.createHash("sha256").update(`${intent}:${target}:${code}`).digest("hex");
  return stored.phoneOtpHash === expected;
}

export async function startEmailChange(userId: number, currentEmail: string, newEmail: string): Promise<void> {
  const trimmed = newEmail.trim().toLowerCase();
  if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    throw new AppError(400, "InvalidEmail", "That email doesn't look right.");
  }
  if (trimmed === currentEmail.toLowerCase()) {
    throw new AppError(400, "SameEmail", "New email is the same as the current one.");
  }
  const dup = await prisma.user.findUnique({ where: { email: trimmed }, select: { userId: true } });
  if (dup && dup.userId !== userId) {
    throw new AppError(409, "EmailTaken", "Another account already uses that email.");
  }
  await issueSensitiveOtp(userId, currentEmail, "email", trimmed);
}

export async function verifyEmailChange(userId: number, currentEmail: string, newEmail: string, code: string): Promise<SafeUser> {
  const trimmed = newEmail.trim().toLowerCase();
  const u = await prisma.user.findUnique({
    where: { userId },
    select: { phoneOtpHash: true, phoneOtpExpiresAt: true, email: true },
  });
  if (!u) throw new AppError(404, "UserNotFound");
  if (!verifySensitiveOtp(u, "email", trimmed, code)) {
    throw new AppError(400, "InvalidOtp", "That code didn't match or has expired.");
  }
  const dup = await prisma.user.findUnique({ where: { email: trimmed }, select: { userId: true } });
  if (dup && dup.userId !== userId) {
    throw new AppError(409, "EmailTaken", "Another account already uses that email.");
  }
  const updated = await prisma.user.update({
    where: { userId },
    data: {
      email: trimmed,
      // The new email is unverified until the user clicks the new
      // verification link below. Better-auth uses this field to gate
      // login; flipping it back to false forces re-verification.
      emailVerified: false,
      phoneOtpHash: null,
      phoneOtpExpiresAt: null,
    },
    include: { stats: true },
  });
  await prisma.account.updateMany({
    where: { userId, providerId: "credential", accountId: currentEmail },
    data: { accountId: trimmed },
  });
  // Send a verify-email link to the NEW address so we know the buyer
  // owns it before lifting the gate.
  const newToken = await issueEmailVerifyToken(userId);
  await sendEmailVerifyMessage(trimmed, updated.firstName, newToken).catch((err) => {
    // eslint-disable-next-line no-console
    console.error("[email-change] new-address verify send failed:", err);
  });
  await audit({
    actorId: userId,
    action: "user.email_change",
    targetType: "user",
    targetId: userId,
    meta: { from: currentEmail, to: trimmed },
  });
  return sanitize(updated);
}

export async function startPhoneChange(userId: number, currentEmail: string, newPhone: string): Promise<void> {
  // Accept Thai input in any format (0812345678, 812345678, +66812345678,
  // "+66 81 234 5678") — normalise to E.164 (+66XXXXXXXXX) for storage
  // + Firebase Phone Auth. Rejects anything that doesn't normalise to
  // a valid 9-digit Thai number.
  const normalized = normalizeThaiPhone(newPhone);
  if (!isValidThaiE164(normalized)) {
    throw new AppError(400, "InvalidPhone", "Phone must be a 9-digit Thai number (with or without +66 / leading 0).");
  }
  // Same-as-current short-circuit so the user gets a clear message
  // instead of a successful OTP they can never act on.
  const me = await prisma.user.findUnique({
    where: { userId },
    select: { phone: true },
  });
  if (me?.phone === normalized) {
    throw new AppError(400, "SamePhone", "New phone is the same as the current one.");
  }
  // Dup-check against other users. phone is not @unique in the schema
  // (legacy data has duplicates), so we enforce uniqueness here at the
  // application layer for the change flow.
  const dup = await prisma.user.findFirst({
    where: { phone: normalized, userId: { not: userId } },
    select: { userId: true },
  });
  if (dup) {
    throw new AppError(409, "PhoneTaken", "Another account already uses that phone number.");
  }
  await issueSensitiveOtp(userId, currentEmail, "phone", normalized);
}

export async function verifyPhoneChange(userId: number, newPhone: string, code: string): Promise<SafeUser> {
  const normalized = normalizeThaiPhone(newPhone);
  if (!isValidThaiE164(normalized)) {
    throw new AppError(400, "InvalidPhone", "Phone must be a 9-digit Thai number.");
  }
  const u = await prisma.user.findUnique({
    where: { userId },
    select: { phoneOtpHash: true, phoneOtpExpiresAt: true },
  });
  if (!u) throw new AppError(404, "UserNotFound");
  if (!verifySensitiveOtp(u, "phone", normalized, code)) {
    throw new AppError(400, "InvalidOtp", "That code didn't match or has expired.");
  }
  // Re-check dup at verify time — the OTP may have been issued at T0
  // and another user could have grabbed the number between T0 and now.
  const dup = await prisma.user.findFirst({
    where: { phone: normalized, userId: { not: userId } },
    select: { userId: true },
  });
  if (dup) {
    throw new AppError(409, "PhoneTaken", "Another account claimed that phone number while you were verifying. Try a different one.");
  }
  const updated = await prisma.user.update({
    where: { userId },
    data: {
      phone: normalized,
      // Flip phoneVerifiedAt to NULL — the buyer has to re-verify the
      // new number via the normal phone-OTP flow on next sign-in.
      phoneVerifiedAt: null,
      phoneOtpHash: null,
      phoneOtpExpiresAt: null,
    },
    include: { stats: true },
  });
  await audit({
    actorId: userId,
    action: "user.phone_change",
    targetType: "user",
    targetId: userId,
    meta: { phone: normalized },
  });
  return sanitize(updated);
}

// POST /auth/change-password. Requires the current password.
export async function changePassword(
  userId: number,
  input: ChangePasswordInput,
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { userId },
    select: {
      password: true, phone: true, phoneVerifiedAt: true, email: true,
      totpEnabled: true, totpSecret: true,
    },
  });
  if (!user) throw new AppError(404, "UserNotFound");
  // Google-only users must use /auth/set-password instead.
  if (!user.password) throw new AppError(400, "NoPasswordSet");

  const ok = await bcrypt.compare(input.currentPassword, user.password);
  if (!ok) throw new AppError(401, "InvalidCurrentPassword");

  // Three-channel second factor — TOTP (with backup-code fallback) /
  // SMS / email. See ensureSensitiveOtp for the priority order.
  await ensureSensitiveOtp(userId, user, {
    otpCode: input.otpCode,
    totpCode: input.totpCode,
    backupCode: input.backupCode,
  });

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
    select: {
      password: true, phone: true, phoneVerifiedAt: true, email: true,
      totpEnabled: true, totpSecret: true,
    },
  });
  if (!user) throw new AppError(404, "UserNotFound");
  if (user.password) throw new AppError(400, "PasswordAlreadySet");

  await ensureSensitiveOtp(userId, user, {
    otpCode: input.otpCode,
    totpCode: input.totpCode,
    backupCode: input.backupCode,
  });

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
 * Require a fresh second factor for sensitive password ops. Three
 * channels in priority order:
 *
 *   1. TOTP (when totpEnabled) — replaces SMS/email entirely. The
 *      caller can also pass a `backupCode` to use a single-use recovery
 *      code in place of a live TOTP.
 *   2. SMS OTP (when phone is verified) — same flow as before, code
 *      from /auth/request-otp.
 *   3. Email OTP (when no phone verified) — code from
 *      /auth/request-email-otp, sent to user.email. NEW: closes the
 *      hole where a phoneless user could change password without any
 *      second factor.
 *
 * Consumes the verification row on success. Throws 400 OtpRequired /
 * TotpRequired / InvalidOtp / InvalidTotp / InvalidBackupCode /
 * NoPendingOtp / OtpExpired.
 */
async function ensureSensitiveOtp(
  userId: number,
  user: {
    phone: string | null;
    phoneVerifiedAt: Date | null;
    email: string;
    totpEnabled: boolean;
    totpSecret: string | null;
  },
  input: {
    otpCode?: string;
    totpCode?: string;
    backupCode?: string;
  },
): Promise<void> {
  // Path 1 — TOTP-as-primary
  if (user.totpEnabled && user.totpSecret) {
    if (input.backupCode) {
      const ok = await consumeBackupCode(userId, input.backupCode);
      if (!ok) throw new AppError(400, "InvalidBackupCode");
      return;
    }
    if (!input.totpCode) throw new AppError(400, "TotpRequired");
    const ok = await verifyTotpCode(input.totpCode, user.totpSecret);
    if (!ok) throw new AppError(400, "InvalidTotp");
    return;
  }

  // Path 2 + 3 — OTP via Verification table. Hash target is phone for
  // SMS, email for email-OTP. Identifier is the same so only one
  // pending OTP per user across channels (avoids replay across paths).
  if (!input.otpCode) throw new AppError(400, "OtpRequired");
  const target = (user.phone && user.phoneVerifiedAt) ? user.phone : user.email;

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

  const expected = hashCode(userId, target, input.otpCode);
  if (expected !== pending.value) throw new AppError(400, "InvalidOtp");

  // Consume so the same code can't be replayed against another action.
  await prisma.verification.delete({ where: { id: pending.id } });
}

/** Issue an email OTP for sensitive password ops when the user has no
 *  verified phone. Uses the same Verification row as SMS OTP — only
 *  one pending per user — so the same /auth/request-otp UX works
 *  except the code lands in their email inbox.  */
export async function requestEmailOtpForSensitive(userId: number): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { userId },
    select: { email: true, firstName: true },
  });
  if (!user) throw new AppError(404, "UserNotFound");

  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
  const hash = hashCode(userId, user.email, code);
  const identifier = otpIdentifier(userId);
  await prisma.verification.deleteMany({ where: { identifier } });
  await prisma.verification.create({
    data: { identifier, value: hash, expiresAt: new Date(Date.now() + 5 * 60_000) },
  });

  const body = renderEmailLayout({
    heading: "Your METU verification code",
    intro: `Hi ${escapeHtml(user.firstName)}, here's the 6-digit code you asked for. It expires in 5 minutes. If you didn't request this, ignore the email and consider changing your password.`,
    bodyHtml: `<p style="text-align:center;font-family:monospace;font-size:32px;letter-spacing:8px;color:#facc15;font-weight:bold;margin:24px 0;">${code}</p>`,
  });
  await sendEmail({
    to: user.email,
    subject: `METU verification code — ${code}`,
    html: body,
  }).catch((err) => {
    // eslint-disable-next-line no-console
    console.error("[email-otp] send failed:", err);
  });
}

/** Tell the client which second-factor channel the form should render. */
export async function getSensitiveOtpChannel(userId: number): Promise<{
  channel: "totp" | "sms" | "email";
  hint: string;
  hasBackupCodes: boolean;
}> {
  const user = await prisma.user.findUnique({
    where: { userId },
    select: {
      email: true,
      phone: true,
      phoneVerifiedAt: true,
      totpEnabled: true,
      totpBackupCodes: true,
    },
  });
  if (!user) throw new AppError(404, "UserNotFound");

  if (user.totpEnabled) {
    return {
      channel: "totp",
      hint: "Enter the 6-digit code from your authenticator app.",
      hasBackupCodes: (user.totpBackupCodes?.length ?? 0) > 0,
    };
  }
  if (user.phone && user.phoneVerifiedAt) {
    // Redact: keep last 4 digits, mask the rest.
    const tail = user.phone.slice(-4);
    return {
      channel: "sms",
      hint: `We'll text a 6-digit code to ${user.phone.replace(/.(?=.{4})/g, "•")} (••••${tail}).`,
      hasBackupCodes: false,
    };
  }
  // Redact email for hint: j****@example.com
  const [local, domain] = user.email.split("@");
  const redacted = local && domain
    ? `${local[0] ?? ""}${"•".repeat(Math.max(1, local.length - 1))}@${domain}`
    : user.email;
  return {
    channel: "email",
    hint: `We'll email a 6-digit code to ${redacted}.`,
    hasBackupCodes: false,
  };
}

/**
 * PATCH /auth/phone. Clears phoneVerifiedAt and normalises the
 * number. OTP delivery is a separate POST /auth/request-otp call.
 */
export async function updatePhone(
  userId: number,
  input: UpdatePhoneInput,
): Promise<void> {
  // Strip non-digits / non-plus-sign first to clean up paste-from-Word
  // garbage, then run through Thai E.164 normalisation so the stored
  // string is canonical (`+66812345678` regardless of how the user
  // typed it). Same fix the register() path got — keeps the firebase
  // SMS cross-account guard's exact-match working.
  const cleaned = input.phone.replace(/[^\d+]/g, "");
  if (cleaned.length < 7) throw new AppError(400, "PhoneTooShort");
  const normalised = normalizeThaiPhone(cleaned) ?? cleaned;

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
const EMAIL_VERIFY_TOKEN_TTL_MIN = 30;
const PHONE_OTP_TTL_MIN = 10;
const PHONE_OTP_LENGTH = 6;

// helpers - generate + persist email-verify token, return raw
// token for the email link.
async function issueEmailVerifyToken(userId: number): Promise<string> {
  const raw = crypto.randomBytes(32).toString("base64url");
  const tokenHash = crypto.createHash("sha256").update(raw).digest("hex");
  const expiresAt = new Date(Date.now() + EMAIL_VERIFY_TOKEN_TTL_MIN * 60_000);
  await prisma.emailVerifyToken.create({
    data: { userId, tokenHash, expiresAt },
  });
  return raw;
}

// generate 6-digit OTP, hash + store on User, return raw OTP
// to console-log. Real SMS would replace this with a Twilio send.
// crypto.randomInt instead of Math.random — OTP space is
// only 1M so anything predictable enough to leak the seed leaks every
// in-flight OTP. crypto.randomInt is CSPRNG-backed, not Mersenne Twister.
async function issuePhoneOtp(userId: number): Promise<string> {
  const code = String(crypto.randomInt(0, 10 ** PHONE_OTP_LENGTH))
    .padStart(PHONE_OTP_LENGTH, "0");
  const hash = crypto.createHash("sha256").update(code).digest("hex");
  const expiresAt = new Date(Date.now() + PHONE_OTP_TTL_MIN * 60_000);
  await prisma.user.update({
    where: { userId },
    data: { phoneOtpHash: hash, phoneOtpExpiresAt: expiresAt },
  });
  return code;
}

async function sendEmailVerifyMessage(
  email: string,
  firstName: string,
  rawToken: string,
): Promise<void> {
  const base = SITE_URL;
  const link = `${base}/verify-email?token=${rawToken}`;
  const html = renderEmailLayout({
    heading: `Hi ${escapeHtml(firstName)} - confirm your email`,
    intro: `One last step before your METU account is active. Click below to confirm <strong>${escapeHtml(email)}</strong>; the link is valid for <strong>${EMAIL_VERIFY_TOKEN_TTL_MIN} minutes</strong>.`,
    cta: { label: "Verify email", url: link },
    fallbackUrl: link,
    bodyHtml: `
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
      <p style="margin: 0; font-size: 13px; line-height: 1.6; color: #94a3b8;">
        Didn't sign up for METU? Ignore this email - the unverified account expires automatically.
      </p>
    `,
  });
  const text = [
    `Hi ${firstName},`,
    "",
    `Confirm your METU email (${email}) using this link (valid ${EMAIL_VERIFY_TOKEN_TTL_MIN} minutes):`,
    link,
    "",
    "Didn't sign up? Ignore this message.",
    "",
    "- METU",
  ].join("\n");
  await sendEmail({
    to: email,
    subject: "Confirm your METU email",
    html,
    text,
  });
}

function logPhoneOtp(phone: string, code: string): void {
  // eslint-disable-next-line no-console
  console.log(
    `[phone-otp] phone=${phone} code=${code} ttl=${PHONE_OTP_TTL_MIN}min ` +
      `(real SMS would be sent here)`,
  );
}

/**
 * POST /auth/forgot-password. Always succeeds (no email enumeration).
 * Stores SHA-256 of the token; raw token only goes in the email link.
 */
export async function forgotPassword(input: ForgotPasswordInput): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user) return;

  const raw = crypto.randomBytes(32).toString("base64url");
  const tokenHash = crypto.createHash("sha256").update(raw).digest("hex");
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MIN * 60_000);

  await prisma.passwordResetToken.create({
    data: { userId: user.userId, tokenHash, expiresAt },
  });

  // Link points at the BFF where /reset-password lives.
  const base = SITE_URL;
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
/**
 * Quick "is this token still good?" probe used by /reset-password to
 * render the right state before the form is submitted. Doesn't
 * consume the token.
 */
export async function checkResetToken(rawToken: string): Promise<{ valid: boolean }> {
  if (!rawToken) return { valid: false };
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  const row = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    select: { consumedAt: true, expiresAt: true },
  });
  if (!row) return { valid: false };
  if (row.consumedAt) return { valid: false };
  if (row.expiresAt < new Date()) return { valid: false };
  return { valid: true };
}

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
): Promise<{ backupCodes: string[] }> {
  const user = await prisma.user.findUnique({
    where: { userId },
    select: { totpSecret: true, totpEnabled: true },
  });
  if (!user) throw new AppError(404, "UserNotFound");
  if (user.totpEnabled) throw new AppError(400, "AlreadyEnrolled");
  if (!user.totpSecret) throw new AppError(400, "NoEnrollmentInProgress");
  const ok = await verifyTotpCode(code, user.totpSecret);
  if (!ok) throw new AppError(400, "InvalidTotp");

  // Mint 10 backup codes alongside the enable. Plaintext is returned
  // ONCE so the UI can render the BackupCodesReveal modal; only the
  // hashes are persisted.
  const { plaintext, hashes } = mintBackupCodes(userId);
  await prisma.user.update({
    where: { userId },
    data: { totpEnabled: true, totpBackupCodes: hashes },
  });
  await audit({
    actorId: userId,
    action: "user.totp_enabled",
    targetType: "user",
    targetId: userId,
    meta: { backupCodes: 10 },
  });
  return { backupCodes: plaintext };
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
    // Wipe backup codes alongside the secret — re-enabling 2FA later
    // mints a fresh set. Don't leave dead hashes on a disabled user.
    data: { totpEnabled: false, totpSecret: null, totpBackupCodes: [] },
  });
  await audit({
    actorId: userId,
    action: "user.totp_disabled",
    targetType: "user",
    targetId: userId,
  });
}

/**
 * POST /auth/totp/backup-codes/regenerate. Invalidates all existing
 * backup codes and mints 10 new ones. Requires:
 *   • the user's current password (proves possession of session)
 *   • a fresh TOTP code (proves possession of the authenticator)
 * Returns the plaintext codes once.
 */
export async function totpRegenerateBackupCodes(
  userId: number,
  password: string,
  totpCode: string,
): Promise<{ backupCodes: string[] }> {
  const user = await prisma.user.findUnique({
    where: { userId },
    select: { password: true, totpEnabled: true, totpSecret: true },
  });
  if (!user) throw new AppError(404, "UserNotFound");
  if (!user.totpEnabled || !user.totpSecret) {
    throw new AppError(400, "NotEnrolled", "TOTP isn't enabled.");
  }
  if (!user.password) throw new AppError(400, "NoPasswordSet");

  const passwordOk = await bcrypt.compare(password, user.password);
  if (!passwordOk) throw new AppError(401, "InvalidPassword");

  const totpOk = await verifyTotpCode(totpCode, user.totpSecret);
  if (!totpOk) throw new AppError(400, "InvalidTotp");

  const { plaintext, hashes } = mintBackupCodes(userId);
  await prisma.user.update({
    where: { userId },
    data: { totpBackupCodes: hashes },
  });
  await audit({
    actorId: userId,
    action: "user.totp_backup_regenerated",
    targetType: "user",
    targetId: userId,
    meta: { backupCodes: 10 },
  });
  return { backupCodes: plaintext };
}

/**
 * Consume a backup code in place of a live TOTP. Removes the matching
 * hash from `totpBackupCodes` (single-use). Returns true on success.
 */
async function consumeBackupCode(userId: number, raw: string): Promise<boolean> {
  const canonical = canonicalBackupCode(raw);
  if (canonical.length !== 10) return false;
  const candidate = hashBackupCode(userId, canonical);
  const user = await prisma.user.findUnique({
    where: { userId },
    select: { totpBackupCodes: true },
  });
  if (!user || !user.totpBackupCodes || user.totpBackupCodes.length === 0) {
    return false;
  }
  if (!user.totpBackupCodes.includes(candidate)) return false;
  const next = user.totpBackupCodes.filter((h) => h !== candidate);
  await prisma.user.update({
    where: { userId },
    data: { totpBackupCodes: next },
  });
  await audit({
    actorId: userId,
    action: "user.totp_backup_consumed",
    targetType: "user",
    targetId: userId,
    meta: { remaining: next.length },
  });
  return true;
}

/**
 * TOTP step-up. Verifies a fresh code and stamps Session.lastTotpAt
 * so requireRecent2FA lets the user proceed with the sensitive action.
 */
export async function totpStepUp(
  userId: number,
  sessionId: number | null,
  code: string,
  // optional. When supplied (instead of `code`), the live TOTP
  // path is skipped and the backup code is consumed single-use.
  backupCode?: string,
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

  if (backupCode) {
    const ok = await consumeBackupCode(userId, backupCode);
    if (!ok) throw new AppError(400, "InvalidBackupCode");
  } else {
    const ok = await verifyTotpCode(code, user.totpSecret);
    if (!ok) throw new AppError(400, "InvalidTotp");
  }

  await prisma.session.update({
    where: { id: sessionId },
    data: { lastTotpAt: new Date() },
  });
  await audit({
    actorId: userId,
    action: backupCode ? "auth.totp.step_up_backup" : "auth.totp.step_up",
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

/**
 * GDPR self-delete. The user removes their own account
 * via DELETE /auth/me. Mirrors admin.deleteUser's hybrid logic
 * (fresh = hard delete, history = anonymise) but skips the
 * SelfDeleteForbidden guard because here actor === target by
 * design.
 * Audit row uses `user.self_delete` so the operator audit feed
 * tells self-initiated removals apart from admin-initiated ones.
 */
export async function selfDelete(
  userId: number,
  req?: Pick<import("express").Request, "ip" | "headers"> | null,
): Promise<void> {
  // Last-admin guard still applies — a sole admin removing themselves
  // would lock the marketplace out of the admin surface.
  const stats = await prisma.userStats.findUnique({
    where: { userId },
    select: { role: true },
  });
  if (stats?.role === "admin") {
    const liveAdmins = await prisma.userStats.count({
      where: { role: "admin" },
    });
    if (liveAdmins <= 1) {
      throw new AppError(
        400,
        "LastAdminCannotBeRemoved",
        "You're the only admin. Promote another admin before removing your account.",
      );
    }
  }

  // block self-delete while a Stripe
  // PaymentIntent is still pending. If we anonymise the buyer
  // mid-checkout, the webhook flips the order to paid later and
  // sendOrderReceipt mails `deleted_<id>@deleted.invalid` which
  // bounces. Cancel/finish the checkout first, then erase.
  const pendingOrders = await prisma.order.count({
    where: { userId, status: "pending" },
  });
  if (pendingOrders > 0) {
    throw new AppError(
      409,
      "PendingOrderBlocksSelfDelete",
      "You have an order in flight. Cancel or finish the checkout first, then try again.",
      { pendingOrders },
    );
  }

  const [orderCount, reviewCount, txCount] = await Promise.all([
    prisma.order.count({ where: { userId } }),
    prisma.productReview.count({ where: { userId } }),
    prisma.transaction.count({ where: { userId } }),
  ]);
  const historyCount = orderCount + reviewCount + txCount;

  await audit({
    actorId: userId,
    action: "user.self_delete",
    targetType: "user",
    targetId: userId,
    meta: { historyCount },
    req: req ?? undefined,
  });

  if (historyCount === 0) {
    await prisma.user.delete({ where: { userId } });
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { userId },
      data: {
        email: `deleted_${userId}@deleted.invalid`,
        username: `deleted_user_${userId}`,
        firstName: "Deleted",
        lastName: "User",
        phone: null,
        profileImage: null,
        dateOfBirth: null,
        password: null,
        totpSecret: null,
        totpEnabled: false,
        requirePasswordReset: false,
      },
    });
    await tx.session.deleteMany({ where: { userId } });
    await tx.account.deleteMany({ where: { userId } });
  });
}
