// Login two-step verify — pre-auth state holder. After password is
// validated but before the better-auth session is minted, the server
// stashes the credentials encrypted under a short-lived token. The
// /auth/login/verify endpoint pulls them back out, validates the
// second-factor code, then replays signInEmail to actually mint the
// session.
//
// Encryption is AES-256-GCM with a key derived from JWT_SECRET via
// SHA-256 (so we don't need a second env secret). The encrypted blob
// includes a random 12-byte IV + 16-byte auth tag, so a leaked token
// can't be replayed against another user or after the TTL.
//
// State row lives in the Verification table (TTL 5 minutes, identifier
// `login-verify:<token>`). Single-use — successful verify deletes the
// row. Multiple parallel logins from the same user mint distinct rows.
//
// Trade-off: we hold the plaintext password (encrypted) for 5 minutes
// in DB. The threat model is "attacker who already has the password
// is trying to MFA past it" — i.e. they ALREADY know the credential,
// so the encrypted row is no incremental leak. The encryption is
// belt-and-suspenders against DB-snooping admins / backup leaks.

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

/** Single-use — call this on successful verify so the token can't be replayed. */
export async function consumeLoginPreAuthToken(token: string): Promise<void> {
  await prisma.verification
    .deleteMany({ where: { identifier: `login-verify:${token}` } })
    .catch(() => {});
}
