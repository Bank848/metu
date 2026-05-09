// Login two-step verify pre-auth holder. Stashes credentials AES-256-GCM
// encrypted (key from JWT_SECRET) in a Verification row keyed by
// `login-verify:<token>`. 5-min TTL, single-use on successful verify.

import crypto from "node:crypto";
import { prisma } from "../db/prisma.js";
import { AppError } from "./errors.js";

const ALGO = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const TOKEN_BYTES = 32; // → 64 hex chars
const TTL_MS = 5 * 60 * 1000;

function getKey(): Buffer {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("JWT_SECRET must be at least 16 chars for login-verify encryption");
  }
  return crypto.createHash("sha256").update(secret).digest();
}

function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64url");
}

function decrypt(blob: string): string | null {
  try {
    const buf = Buffer.from(blob, "base64url");
    if (buf.length < IV_LENGTH + TAG_LENGTH + 1) return null;
    const iv = buf.subarray(0, IV_LENGTH);
    const tag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const enc = buf.subarray(IV_LENGTH + TAG_LENGTH);
    const dec = crypto.createDecipheriv(ALGO, getKey(), iv);
    dec.setAuthTag(tag);
    const out = Buffer.concat([dec.update(enc), dec.final()]);
    return out.toString("utf8");
  } catch {
    return null;
  }
}

export interface PreAuthPayload {
  userId: number;
  email: string;
  password: string;
}

/** Mint a fresh pre-auth token + persist its encrypted payload. */
export async function issueLoginPreAuthToken(
  payload: PreAuthPayload,
): Promise<string> {
  const token = crypto.randomBytes(TOKEN_BYTES).toString("hex");
  const blob = encrypt(JSON.stringify(payload));
  await prisma.verification.create({
    data: {
      identifier: `login-verify:${token}`,
      value: blob,
      expiresAt: new Date(Date.now() + TTL_MS),
    },
  });
  return token;
}

/** Resolve a pre-auth token to its payload OR throw 400 InvalidPreAuth. */
export async function resolveLoginPreAuthToken(
  token: string,
): Promise<PreAuthPayload> {
  if (!token || typeof token !== "string" || token.length !== TOKEN_BYTES * 2) {
    throw new AppError(400, "InvalidPreAuth", "Pre-auth token is malformed.");
  }
  const row = await prisma.verification.findFirst({
    where: { identifier: `login-verify:${token}` },
    orderBy: { createdAt: "desc" },
  });
  if (!row) throw new AppError(400, "InvalidPreAuth", "This verification link expired. Sign in again.");
  if (row.expiresAt.getTime() < Date.now()) {
    await prisma.verification.delete({ where: { id: row.id } }).catch(() => {});
    throw new AppError(400, "InvalidPreAuth", "This verification link expired. Sign in again.");
  }
  const json = decrypt(row.value);
  if (!json) {
    throw new AppError(400, "InvalidPreAuth", "Pre-auth token is corrupt.");
  }
  try {
    return JSON.parse(json) as PreAuthPayload;
  } catch {
    throw new AppError(400, "InvalidPreAuth", "Pre-auth token is corrupt.");
  }
}

/** Single-use consumer; returns deleted count so the caller can spot replays. */
export async function consumeLoginPreAuthToken(token: string): Promise<{ deleted: number }> {
  let deleted = 0;
  try {
    const result = await prisma.verification.deleteMany({
      where: { identifier: `login-verify:${token}` },
    });
    deleted = result.count ?? 0;
  } catch {
    // swallow — keep deleted=0
  }
  // Clear the matching attempt-counter row.
  await prisma.verification
    .deleteMany({ where: { identifier: `login-verify-attempts:${token}` } })
    .catch(() => {});
  return { deleted };
}

/**
 * Per-token OTP attempt limiter (5 wrong codes burns the pre-auth
 * token). State lives in a sibling Verification row keyed on
 * `login-verify-attempts:<token>` with the same TTL.
 */
const MAX_OTP_ATTEMPTS = 5;

export async function recordFailedLoginAttempt(
  token: string,
): Promise<{ remaining: number; locked: boolean }> {
  const identifier = `login-verify-attempts:${token}`;
  const existing = await prisma.verification.findFirst({
    where: { identifier },
    orderBy: { createdAt: "desc" },
  });
  let count = 1;
  if (existing) {
    try {
      const parsed = JSON.parse(existing.value) as { count?: number };
      count = (parsed.count ?? 0) + 1;
    } catch {
      count = 1;
    }
    await prisma.verification.update({
      where: { id: existing.id },
      data: { value: JSON.stringify({ count }) },
    });
  } else {
    await prisma.verification.create({
      data: {
        identifier,
        value: JSON.stringify({ count }),
        expiresAt: new Date(Date.now() + TTL_MS),
      },
    });
  }
  const remaining = Math.max(0, MAX_OTP_ATTEMPTS - count);
  const locked = count >= MAX_OTP_ATTEMPTS;
  if (locked) {
    // Burn the pre-auth token; attacker must restart from the password.
    await consumeLoginPreAuthToken(token);
  }
  return { remaining, locked };
}
