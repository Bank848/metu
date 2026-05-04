/**
 * Trusted-device cookie + DB row helpers.
 * The browser holds a 32-byte hex cookie (`metu-trust`); the DB
 * stores SHA-256(cookie) so a leaked DB dump can't be replayed to
 * impersonate a trusted device. On every guarded login we:
 *   1. Read the cookie. If present, hash it and look for a row that
 *      belongs to the user being signed in AND hasn't expired yet.
 *      Match → skip the email-OTP gate.
 *   2. After a successful OTP verify, if the user ticked "trust this
 *      device for 7 days", mint a fresh cookie + insert a row.
 * Cookies are HttpOnly + SameSite=Lax + Secure (in prod), Path=/.
 * Expiry matches the DB row at TRUST_DAYS days from now.
 */
import crypto from "node:crypto";
import type { Request, Response } from "express";
import { prisma } from "../db/prisma.js";

export const TRUST_COOKIE_NAME = "metu-trust";
export const TRUST_DAYS = 7;
const TRUST_MS = TRUST_DAYS * 24 * 60 * 60 * 1000;

function hashCookie(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

/** UA → short label like "Chrome on Windows" / "Safari on macOS". */
function deriveLabel(userAgent: string | undefined): string | null {
  if (!userAgent) return null;
  const ua = userAgent.slice(0, 240);
  let browser = "Browser";
  if (/Edg\//.test(ua)) browser = "Edge";
  else if (/Chrome\//.test(ua) && !/Chromium/.test(ua)) browser = "Chrome";
  else if (/Safari\//.test(ua) && !/Chrome/.test(ua)) browser = "Safari";
  else if (/Firefox\//.test(ua)) browser = "Firefox";
  let os = "Device";
  if (/Windows/.test(ua)) os = "Windows";
  else if (/Mac OS X|Macintosh/.test(ua)) os = "macOS";
  else if (/Android/.test(ua)) os = "Android";
  else if (/iPhone|iPad|iOS/.test(ua)) os = "iOS";
  else if (/Linux/.test(ua)) os = "Linux";
  return `${browser} on ${os}`.slice(0, 120);
}

/**
 * Returns true when the request carries a trust cookie that resolves
 * to a non-expired row for `userId`. Also passively prunes expired
 * rows for that user.
 */
export async function isTrustedDevice(
  req: Pick<Request, "cookies" | "headers">,
  userId: number,
): Promise<boolean> {
  const raw = req.cookies?.[TRUST_COOKIE_NAME];
  if (!raw || typeof raw !== "string" || raw.length < 32) return false;
  const fingerprintHash = hashCookie(raw);

  const row = await prisma.trustedDevice.findUnique({
    where: { fingerprintHash },
    select: { userId: true, expiresAt: true },
  });
  if (!row) return false;
  if (row.userId !== userId) return false;
  if (row.expiresAt.getTime() < Date.now()) {
    // Lazy cleanup — drop the stale row so the unique index stays clean.
    await prisma.trustedDevice
      .delete({ where: { fingerprintHash } })
      .catch(() => {});
    return false;
  }
  return true;
}

/**
 * Mint a fresh cookie + DB row for `userId`. Sets the response cookie
 * via Express's `res.cookie` so the browser stores it; subsequent
 * logins from the same browser within TRUST_DAYS skip the OTP gate.
 * Idempotent — if the request already had a valid trust cookie for
 * this user, we extend its expiry instead of minting a new one.
 */
export async function trustThisDevice(
  req: Pick<Request, "cookies" | "headers">,
  res: Response,
  userId: number,
): Promise<void> {
  const existing = req.cookies?.[TRUST_COOKIE_NAME];
  const expiresAt = new Date(Date.now() + TRUST_MS);
  const ua =
    typeof req.headers?.["user-agent"] === "string"
      ? (req.headers["user-agent"] as string)
      : undefined;
  const label = deriveLabel(ua);

  // Reuse the existing cookie value when it already resolves to this
  // user — keeps the cookie value stable across logins so a user with
  // multiple tabs doesn't get a forced re-login on the older tab.
  if (existing && typeof existing === "string" && existing.length >= 32) {
    const fingerprintHash = hashCookie(existing);
    const row = await prisma.trustedDevice.findUnique({
      where: { fingerprintHash },
      select: { userId: true },
    });
    if (row && row.userId === userId) {
      await prisma.trustedDevice.update({
        where: { fingerprintHash },
        data: { expiresAt, label },
      });
      writeCookie(res, existing, expiresAt);
      return;
    }
  }

  // Mint a fresh value.
  const value = crypto.randomBytes(32).toString("hex"); // 64 hex chars
  const fingerprintHash = hashCookie(value);
  await prisma.trustedDevice.create({
    data: { userId, fingerprintHash, label, expiresAt },
  });
  writeCookie(res, value, expiresAt);
}

function writeCookie(res: Response, value: string, expiresAt: Date) {
  res.cookie(TRUST_COOKIE_NAME, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

/** Drop the cookie + the corresponding DB row (e.g. on logout-all). */
export async function revokeTrustForRequest(
  req: Pick<Request, "cookies">,
  res: Response,
): Promise<void> {
  const raw = req.cookies?.[TRUST_COOKIE_NAME];
  res.clearCookie(TRUST_COOKIE_NAME, { path: "/" });
  if (raw && typeof raw === "string" && raw.length >= 32) {
    await prisma.trustedDevice
      .delete({ where: { fingerprintHash: hashCookie(raw) } })
      .catch(() => {});
  }
}
