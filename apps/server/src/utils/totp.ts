// TOTP wrapper around otplib v13. RFC 6238 defaults (SHA-1, 30s, 6
// digits), 30s tolerance each direction for clock drift.
import {
  generateSecret as otpGenerateSecret,
  generateURI,
  verify,
} from "otplib";

const ISSUER = "METU";

const TOTP_OPTIONS = {
  digits: 6,
  step: 30,
  // 30s tolerance each direction = previous + current + next step.
  toleranceSec: 30,
};

/** Generate a fresh base32 secret. */
export function generateSecret(): string {
  return otpGenerateSecret();
}

// Build the otpauth:// URI for QR rendering. Client-side QR keeps
// the secret out of any server-rendered image blob.
export function buildOtpauthUri(accountEmail: string, secret: string): string {
  return generateURI({
    strategy: "totp",
    label: accountEmail,
    issuer: ISSUER,
    secret,
    algorithm: "sha1",
    digits: TOTP_OPTIONS.digits,
    period: TOTP_OPTIONS.step,
  });
}

// Returns true on match, false on miss or any thrown error.
export async function verifyCode(code: string, secret: string): Promise<boolean> {
  try {
    const result = await verify({
      strategy: "totp",
      token: code,
      secret,
      epochTolerance: TOTP_OPTIONS.toleranceSec,
      digits: TOTP_OPTIONS.digits,
      period: TOTP_OPTIONS.step,
    });
    return Boolean(result?.valid);
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────
// Backup codes — single-use TOTP recovery codes
// ─────────────────────────────────────────────────────────────────────

import crypto from "node:crypto";

const BACKUP_CODE_COUNT = 10;
// Format: 4-4-2 chars from a friendly base32-ish alphabet (no 0/O, 1/I).
// Total 10 chars, plain text shown to the user as "ABCD-EFGH-IJ".
const BACKUP_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Pretty-print a 10-char raw code as ABCD-EFGH-IJ. */
function formatBackupCode(raw: string): string {
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 10)}`;
}

/** Strip dashes + uppercase so input matches stored canonical form. */
export function canonicalBackupCode(input: string): string {
  return String(input ?? "").replace(/[\s-]/g, "").toUpperCase();
}

/** SHA-256 of "<userId>:backup:<canonical>". Includes the user ID so a
    leaked code can't be replayed against another account. */
export function hashBackupCode(userId: number, canonical: string): string {
  return crypto
    .createHash("sha256")
    .update(`${userId}:backup:${canonical}`)
    .digest("hex");
}

/**
 * Generate `BACKUP_CODE_COUNT` fresh codes. Returns both the plaintext
 * (to show the user once) and the hashes (to store in DB).
 */
export function mintBackupCodes(
  userId: number,
): { plaintext: string[]; hashes: string[] } {
  const plaintext: string[] = [];
  const hashes: string[] = [];
  for (let i = 0; i < BACKUP_CODE_COUNT; i++) {
    let raw = "";
    const bytes = crypto.randomBytes(10);
    for (let j = 0; j < 10; j++) {
      raw += BACKUP_ALPHABET[bytes[j]! % BACKUP_ALPHABET.length];
    }
    plaintext.push(formatBackupCode(raw));
    hashes.push(hashBackupCode(userId, raw));
  }
  return { plaintext, hashes };
}
