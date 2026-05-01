import { cookies } from "next/headers";
import crypto from "node:crypto";

/**
 * Phase 42 — short-lived signed cookie that carries the email of the
 * account currently in the verify-email / verify-phone flow.
 *
 * Why: we used to put `?email=...` in the URL after register and after
 * a verification-blocked login attempt. That leaks via referrer,
 * browser history, and Fly access logs. A signed cookie keeps the
 * value off the URL while still letting verify pages know who they're
 * verifying without requiring a full session.
 *
 * Format: base64url(payload).hex(hmacSha256(payload))
 *   payload = JSON { email, exp }
 *
 * exp is 1 hour after issuance — long enough to read the email and
 * type a 6-digit OTP, short enough that a stolen cookie has limited
 * value (and the cookie itself is HttpOnly + Secure + SameSite=Lax).
 */

const COOKIE_NAME = "metu_pv";
const TTL_SECONDS = 60 * 60;

function getSecret(): string {
  return (
    process.env.PENDING_VERIFY_SECRET ??
    process.env.NEXTAUTH_SECRET ??
    process.env.BETTER_AUTH_SECRET ??
    "metu-dev-pending-verify-secret-change-me"
  );
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", getSecret()).update(payload).digest("hex");
}

export function makePendingVerifyToken(email: string): string {
  const payload = JSON.stringify({ email, exp: Math.floor(Date.now() / 1000) + TTL_SECONDS });
  const b64 = Buffer.from(payload, "utf8").toString("base64url");
  return `${b64}.${sign(b64)}`;
}

export function readPendingVerifyToken(token: string | undefined): string | null {
  if (!token) return null;
  const dot = token.indexOf(".");
  if (dot < 0) return null;
  const b64 = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (sign(b64) !== sig) return null;
  try {
    const payload = JSON.parse(Buffer.from(b64, "base64url").toString("utf8")) as {
      email: string;
      exp: number;
    };
    if (typeof payload.email !== "string") return null;
    if (payload.exp * 1000 < Date.now()) return null;
    return payload.email;
  } catch {
    return null;
  }
}

/** Read the pending-verify email from the active request cookies. */
export function getPendingVerifyEmail(): string | null {
  return readPendingVerifyToken(cookies().get(COOKIE_NAME)?.value);
}

/** Headers helper used by BFF route handlers. */
export function buildPendingVerifyCookie(email: string): string {
  const token = makePendingVerifyToken(email);
  const isProd = process.env.NODE_ENV === "production";
  return [
    `${COOKIE_NAME}=${token}`,
    "Path=/",
    `Max-Age=${TTL_SECONDS}`,
    "HttpOnly",
    "SameSite=Lax",
    isProd ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");
}

/** Clear the cookie (used after both checks pass). */
export function buildClearedPendingVerifyCookie(): string {
  return [`${COOKIE_NAME}=`, "Path=/", "Max-Age=0", "HttpOnly", "SameSite=Lax"].join("; ");
}

export const PENDING_VERIFY_COOKIE_NAME = COOKIE_NAME;
