/**
 * Phase 16.2 — TOTP 2FA helper.
 *
 * Wraps `otplib`'s functional API (v13+) with our defaults + the
 * issuer label. Single source of truth so service callers don't
 * need to configure window/algorithm/digits per call.
 *
 * Algorithm: SHA-1 + 30-second window + 6 digits — RFC 6238 default,
 * what every authenticator app (Google Authenticator, Authy,
 * 1Password, Bitwarden) expects without configuration.
 *
 * Window of 1 means we accept the previous, current, and next code
 * (90-second tolerance) — covers clock drift between user's phone
 * and our server without making the codes meaningfully easier to
 * brute-force.
 */
import {
  generateSecret as otpGenerateSecret,
  generateURI,
  verify,
} from "otplib";

const ISSUER = "METU";

const TOTP_OPTIONS = {
  digits: 6,
  step: 30,
  // 30 seconds of tolerance each direction = previous + current + next
  // 30s window. Same effective behaviour as otplib v12's `window: 1`.
  toleranceSec: 30,
};

/** Generate a new base32 secret. ~32 chars, safe for QR + manual entry. */
export function generateSecret(): string {
  return otpGenerateSecret();
}

/**
 * Build the otpauth:// URI that authenticator apps consume. Embeds
 * the issuer + account label (the user's email) so the resulting
 * entry in their app reads "METU (alice@example.com)".
 *
 * The URI is what the QR code renders. We don't generate the QR
 * image server-side — the BFF passes the URI to a client-side QR
 * library so the secret never leaves the browser as an image blob
 * (smaller payload + simpler).
 */
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

/**
 * Verify a 6-digit code against the user's stored secret. Returns
 * true on match (within the configured window), false on mismatch
 * or any thrown error (malformed secret, etc).
 *
 * otplib v13's `verify` is async-by-default but accepts both async
 * and sync crypto plugins; for our usage (HMAC-SHA-1 via Node's
 * built-in WebCrypto) it resolves synchronously without the await.
 * We wrap defensively in case a future plugin swap returns a
 * Promise.
 */
export async function verifyCode(code: string, secret: string): Promise<boolean> {
  try {
    const result = await verify({
      strategy: "totp",
      token: code,
      secret,
      // otplib v13 calls this `epochTolerance` (seconds), distinct
      // from v12's `window` (step counts). 30s symmetric =
      // previous + current + next 30-second steps.
      epochTolerance: TOTP_OPTIONS.toleranceSec,
      digits: TOTP_OPTIONS.digits,
      period: TOTP_OPTIONS.step,
    });
    // VerifyResult is a discriminated union: { valid: true, delta }
    // on match, { valid: false } on miss.
    return Boolean(result?.valid);
  } catch {
    return false;
  }
}
