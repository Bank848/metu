import bcrypt from "bcryptjs";
import type { UserRole } from "@prisma/client";
import { prisma } from "../db/prisma.js";
import { AppError } from "../utils/errors.js";
import { findFirstProfaneField } from "../utils/profanity.js";
import type {
  ChangePasswordInput,
  LoginInput,
  RegisterInput,
  SafeUser,
  UpdateProfileInput,
} from "../models/auth.model.js";

/**
 * Strip the bcrypt hash before any user object crosses the network.
 * Single source of truth — every controller that returns a user
 * passes the row through this.
 */
function sanitize(user: any): SafeUser {
  if (!user) return user;
  const { password, ...safe } = user;
  return safe as SafeUser;
}

/**
 * Hashing cost — 10 rounds matches the legacy Next route. Higher
 * costs (12+) feel safer but add ~250 ms per login on the demo Fly
 * machine, which is more than the rest of the request combined.
 */
const BCRYPT_ROUNDS = 10;

export interface AuthOutcome {
  user: SafeUser;
  role: UserRole;
}

/**
 * Login — verifies credentials, side-effects an active cart row if
 * the user doesn't have one yet (a demo convenience inherited from
 * the BFF route), throws `AppError(401)` for ANY failure mode so
 * callers can't distinguish "wrong email" from "wrong password" or
 * "soft-deleted account" — keeps the response surface flat to
 * attackers.
 */
export async function login(input: LoginInput): Promise<AuthOutcome> {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    include: {
      stats: true,
      carts: { where: { status: "active" }, take: 1, select: { cartId: true } },
    },
  });
  if (!user || user.deletedAt) {
    throw new AppError(401, "InvalidCredentials");
  }
  const ok = await bcrypt.compare(input.password, user.password);
  if (!ok) throw new AppError(401, "InvalidCredentials");

  // Background-create active cart if missing — fire-and-forget so
  // the login response isn't blocked on it.
  if (user.carts.length === 0) {
    void prisma.cart
      .create({ data: { userId: user.userId, status: "active" } })
      .catch(() => {});
  }

  const role = (user.stats?.role ?? "buyer") as UserRole;
  return { user: sanitize(user), role };
}

/**
 * Register — runs the profanity gate (same dictionary as Phase 11/F3)
 * BEFORE the duplicate check + DB write so a banned name never
 * pollutes Neon. Throws:
 *   • 400 ProfanityRejected  — slur in username / first / last name
 *   • 409 Conflict           — duplicate username or email
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
  if (dupUsername) throw new AppError(409, "Conflict", "username");
  if (dupEmail) throw new AppError(409, "Conflict", "email");

  const hash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
  const user = await prisma.user.create({
    data: {
      username: input.username,
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      countryId: input.countryId,
      gender: input.gender,
      // dateOfBirth comes in YYYY-MM-DD; pin to UTC midnight so the
      // value doesn't shift across timezones in the DB.
      dateOfBirth: input.dateOfBirth
        ? new Date(`${input.dateOfBirth}T00:00:00.000Z`)
        : undefined,
      password: hash,
      stats: { create: { role: "buyer" } },
      carts: { create: { status: "active" } },
    },
    include: { stats: true },
  });

  return { user: sanitize(user), role: (user.stats?.role ?? "buyer") as UserRole };
}

/**
 * Resolve the user behind a given userId — used by GET /auth/me
 * after the auth middleware has decoded the cookie. Returns `null`
 * when the row is missing or soft-deleted (signals "session is
 * stale, log out").
 */
export async function getById(userId: number): Promise<SafeUser | null> {
  const user = await prisma.user.findUnique({
    where: { userId },
    include: { stats: true, store: true },
  });
  if (!user || user.deletedAt) return null;
  return sanitize(user);
}

/**
 * PATCH /auth/me — same profanity gate as register, plus an email
 * uniqueness check (only if the email actually changed — saves a
 * query on every save).
 */
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

  if (input.email && input.email !== currentEmail) {
    const dup = await prisma.user.findUnique({
      where: { email: input.email },
      select: { userId: true },
    });
    if (dup && dup.userId !== userId) {
      throw new AppError(409, "Conflict", "email");
    }
  }

  const data: Record<string, unknown> = {};
  if (input.firstName !== undefined) data.firstName = input.firstName;
  if (input.lastName !== undefined) data.lastName = input.lastName;
  if (input.email !== undefined) data.email = input.email;
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

/**
 * POST /auth/change-password — requires the current password to be
 * correct (so a stolen session token can't pivot the account
 * password without the old one).
 */
export async function changePassword(
  userId: number,
  input: ChangePasswordInput,
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { userId },
    select: { password: true },
  });
  if (!user) throw new AppError(404, "UserNotFound");

  const ok = await bcrypt.compare(input.currentPassword, user.password);
  if (!ok) throw new AppError(401, "InvalidCurrentPassword");

  const hash = await bcrypt.hash(input.newPassword, BCRYPT_ROUNDS);
  await prisma.user.update({
    where: { userId },
    data: { password: hash },
  });
}
