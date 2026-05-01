import { cookies } from "next/headers";
import crypto from "node:crypto";

/**
 * Phase 42 — short-lived signed cookie that carries the email of the
 * account currently in the verify-email / verify-phone flow, so the
 * pages don't need `?email=` in the URL.
 *
 * Phase 43 — same cookie also carries optional demo fields. The Resend
 * sandbox sender only delivers email to the account owner, and the
 * phone OTP only logs to Fly stdout. For the live defense we surface
 * those values directly on the verify pages as a "demo" banner so the
 * presenter can finish the flow in front of the panel without digging
 * through `flyctl logs`.
 *
 * Format: base64url(payload).hex(hmacSha256(payload))
 *   payload = JSON { email, otp?, link?, exp }
 *
 * The cookie is HttpOnly + SameSite=Lax + Secure (prod) so it stays
 * scoped to the user's own browser. Demo fields self-expire after the
 * cookie's 1h TTL.
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

export interface PendingVerifyPayload {
  email: string;
  /** Phone OTP delivered out-of-band (or in demo, surfaced on the page). */
  otp?: string;
  /** Raw email-verify token; combined with /verify-email for a clickable demo link. */
  emailToken?: string;
}

export function makePendingVerifyToken(input: PendingVerifyPayload): string {
  const payload = JSON.stringify({
    email: input.email,
    ...(input.otp ? { otp: input.otp } : {}),
    ...(input.emailToken ? { emailToken: input.emailToken } : {}),
    exp: Math.floor(Date.now() / 1000) + TTL_SECONDS,
  });
  const b64 = Buffer.from(payload, "utf8").toString("base64url");
  return `${b64}.${sign(b64)}`;
}

export function readPendingVerifyToken(token: string | undefined): PendingVerifyPayload | null {
  if (!token) return null;
  const dot = token.indexOf(".");
  if (dot < 0) return null;
  const b64 = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (sign(b64) !== sig) return null;
  try {
    const payload = JSON.parse(Buffer.from(b64, "base64url").toString("utf8")) as
      | (PendingVerifyPayload & { exp: number })
      | null;
    if (!payload || typeof payload.email !== "string") return null;
    if (payload.exp * 1000 < Date.now()) return null;
    return {
      email: payload.email,
      otp: typeof payload.otp === "string" ? payload.otp : undefined,
      emailToken: typeof payload.emailToken === "string" ? payload.emailToken : undefined,
    };
  } catch {
    return null;
  }
}

/** Read the pending-verify payload from the active request cookies. */
export function getPendingVerify(): PendingVerifyPayload | null {
  return readPendingVerifyToken(cookies().get(COOKIE_NAME)?.value);
}

/** Backwards-compat: only the email. Use `getPendingVerify()` for full payload. */
export function getPendingVerifyEmail(): string | null {
  return getPendingVerify()?.email ?? null;
}

/** Headers helper used by BFF route handlers. */
export function buildPendingVerifyCookie(input: PendingVerifyPayload | string): string {
  const payload: PendingVerifyPayload =
    typeof input === "string" ? { email: input } : input;
  const token = makePendingVerifyToken(payload);
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
