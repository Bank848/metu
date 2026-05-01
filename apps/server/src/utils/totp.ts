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
