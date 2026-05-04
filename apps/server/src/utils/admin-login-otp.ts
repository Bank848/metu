/**
 * Email-OTP gate for the admin demo account.
 * The seed `admin@metu.dev` account is intentionally public (it's
 * announced in seed.ts so reviewers can log in to grade the project),
 * which means anyone hitting the URL knows the credentials. We add a
 * second factor here:
 *   1. Password + (optional) TOTP pass as usual.
 *   2. We generate a 6-digit code, store its SHA-256 in the
 *      `verification` table, and email the code to a private recipient
 *      (the project owner) configured via `ADMIN_OTP_RECIPIENT_EMAIL`.
 *   3. The browser must POST the code back to /auth/login to finish.
 *   4. If "trust this device for 7 days" was ticked, we drop a hashed
 *      cookie (see `trusted-device.ts`) so the OTP step is skipped on
 *      the same browser for 7 days.
 * The recipient email NEVER lives in the repo — only in `process.env`
 * (Fly secret in prod, `.env.local` in dev). The fingerprint registry
 * below is a SHA-256 of the expected recipient committed in code: at
 * boot we hash the live env value and refuse to send if it doesn't
 * match a known good fingerprint, so a leaked secret swap won't
 * silently start mailing the OTP to an attacker-controlled address.
 * Which accounts trigger this gate is a separate env list
 * (`ADMIN_OTP_GUARD_EMAILS`, comma-separated) defaulted to
 * `admin@metu.dev` because that account is already public in seed.ts.
 */
import crypto from "node:crypto";
import { prisma } from "../db/prisma.js";
import { AppError } from "../utils/errors.js";
import { sendEmail } from "../utils/email.js";

const OTP_TTL_MIN = 10;
const OTP_LENGTH = 6;
const MAX_ATTEMPTS = 5;

/** Default trigger list — `admin@metu.dev` is published in seed.ts. */
const DEFAULT_GUARDED_EMAILS = ["admin@metu.dev"];

/** SHA-256 fingerprints of recipient addresses we trust in production. */
const TRUSTED_RECIPIENT_FINGERPRINTS = new Set<string>([
  // Project owner (Fly secret `ADMIN_OTP_RECIPIENT_EMAIL`).
  "48cbf1cfadf5fb54e57dcf0980349b330816647b285d0e4dad75e77b0b5aa4e2",
]);

function fingerprint(email: string): string {
  return crypto
    .createHash("sha256")
    .update(email.trim().toLowerCase())
    .digest("hex");
}

/** Returns the env-configured guard list, or the public default. */
export function guardedEmails(): string[] {
  const raw = process.env.ADMIN_OTP_GUARD_EMAILS?.trim();
  if (!raw) return DEFAULT_GUARDED_EMAILS;
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isGuardedAccount(email: string): boolean {
  return guardedEmails().includes(email.trim().toLowerCase());
}

/**
 * Resolves the recipient address from env. Throws when unset OR when
 * the env value's fingerprint isn't in the registry above — so a Fly
 * secret swap to an attacker-controlled inbox fails closed.
 * Local dev path: when `ADMIN_OTP_DEV_REVEAL=true` we accept any
 * recipient (even unregistered) and ALSO log the code to stdout, so
 * test runs and offline demos work without setting a real address.
 */
function resolveRecipient(): string {
  const recipient = process.env.ADMIN_OTP_RECIPIENT_EMAIL?.trim();
  if (!recipient) {
    throw new AppError(
      503,
      "AdminOtpRecipientMissing",
      "Admin OTP recipient is not configured. Ask the operator to set ADMIN_OTP_RECIPIENT_EMAIL.",
    );
  }
  if (process.env.ADMIN_OTP_DEV_REVEAL === "true") return recipient;
  if (!TRUSTED_RECIPIENT_FINGERPRINTS.has(fingerprint(recipient))) {
    throw new AppError(
      503,
      "AdminOtpRecipientUntrusted",
      "Admin OTP recipient fingerprint is not in the trusted registry. Refusing to send the code.",
    );
  }
  return recipient;
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  const head = local.slice(0, 2);
  return `${head}${"*".repeat(Math.max(1, local.length - 2))}@${domain}`;
}

function generateCode(): string {
  return crypto
    .randomInt(0, 10 ** OTP_LENGTH)
    .toString()
    .padStart(OTP_LENGTH, "0");
}

function codeHash(userId: number, code: string): string {
  return crypto
    .createHash("sha256")
    .update(`admin-otp:${userId}:${code}`)
    .digest("hex");
}

function identifier(userId: number): string {
  return `admin-login-otp:${userId}`;
}

interface VerificationPayload {
  hash: string;
  attempts: number;
}

/**
 * Generate a fresh OTP, store its hash in `verification`, and email
 * the plaintext to the configured recipient. Returns the masked
 * recipient so the BFF can show "code sent to z***@gmail.com" without
 * exposing the full address to the browser.
 */
export async function issueAdminOtp(
  userId: number,
  accountEmail: string,
): Promise<{ recipientMasked: string; devCode?: string }> {
  const recipient = resolveRecipient();
  const code = generateCode();
  const payload: VerificationPayload = { hash: codeHash(userId, code), attempts: 0 };

  await prisma.verification.deleteMany({ where: { identifier: identifier(userId) } });
  await prisma.verification.create({
    data: {
      identifier: identifier(userId),
      value: JSON.stringify(payload),
      expiresAt: new Date(Date.now() + OTP_TTL_MIN * 60_000),
    },
  });

  const subject = `METU admin login code: ${code}`;
  const html = `
    <p>Hello,</p>
    <p>Someone is trying to sign in to the METU admin demo account
    <strong>${accountEmail}</strong>. To allow this sign-in, enter
    this 6-digit code in the open browser tab:</p>
    <p style="font-size:28px;font-family:monospace;letter-spacing:6px;
       background:#f4f4f4;padding:12px 20px;border-radius:8px;
       display:inline-block;">${code}</p>
    <p>The code expires in ${OTP_TTL_MIN} minutes. If this wasn't you,
    you can safely ignore this email — without the code, the sign-in
    won't complete.</p>
  `;

  try {
    await sendEmail({ to: recipient, subject, html });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[admin-otp] email send failed:", err);
    throw new AppError(
      502,
      "AdminOtpSendFailed",
      "Couldn't deliver the admin OTP. Try again in a moment.",
    );
  }

  // Local-dev escape hatch: also log to stdout so anyone running the
  // server without a Resend key can grab the code from the terminal.
  const devReveal = process.env.ADMIN_OTP_DEV_REVEAL === "true";
  if (devReveal) {
    // eslint-disable-next-line no-console
    console.log(`[admin-otp] code for ${accountEmail} -> ${code} (TTL ${OTP_TTL_MIN}m)`);
  }

  return {
    recipientMasked: maskEmail(recipient),
    ...(devReveal ? { devCode: code } : {}),
  };
}

/**
 * Verify a 6-digit code against the latest pending OTP for the user.
 * Throws 401 NeedsAdminOtp when nothing pending, 401 InvalidAdminOtp
 * on mismatch, 401 AdminOtpExpired past TTL, 401 AdminOtpAttemptsExceeded
 * after MAX_ATTEMPTS wrong tries (forces the user to request a fresh
 * code, defeats brute force).
 */
export async function verifyAdminOtp(
  userId: number,
  rawCode: string,
): Promise<void> {
  const code = rawCode.trim();
  if (!/^\d{6}$/.test(code)) {
    throw new AppError(401, "InvalidAdminOtp", "Code must be 6 digits.");
  }

  const pending = await prisma.verification.findFirst({
    where: { identifier: identifier(userId) },
    orderBy: { createdAt: "desc" },
  });
  if (!pending) {
    throw new AppError(401, "NeedsAdminOtp", "No pending admin OTP — request a fresh code.");
  }
  if (pending.expiresAt.getTime() < Date.now()) {
    await prisma.verification.delete({ where: { id: pending.id } });
    throw new AppError(401, "AdminOtpExpired", "Code expired — request a fresh one.");
  }

  let parsed: VerificationPayload;
  try {
    parsed = JSON.parse(pending.value) as VerificationPayload;
  } catch {
    await prisma.verification.delete({ where: { id: pending.id } });
    throw new AppError(401, "NeedsAdminOtp", "Stored OTP was malformed — request a fresh code.");
  }

  if (parsed.attempts >= MAX_ATTEMPTS) {
    await prisma.verification.delete({ where: { id: pending.id } });
    throw new AppError(
      401,
      "AdminOtpAttemptsExceeded",
      "Too many wrong attempts. Request a fresh code.",
    );
  }

  if (codeHash(userId, code) !== parsed.hash) {
    parsed.attempts += 1;
    await prisma.verification.update({
      where: { id: pending.id },
      data: { value: JSON.stringify(parsed) },
    });
    throw new AppError(401, "InvalidAdminOtp", "That code didn't match.");
  }

  // Single-use — burn the row on success.
  await prisma.verification.delete({ where: { id: pending.id } });
}
