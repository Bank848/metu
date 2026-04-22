import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import jwt from "jsonwebtoken";
import type { UserRole } from "@prisma/client";
import { prisma } from "./prisma";

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-only-fallback-secret";
const COOKIE_NAME = "metu_auth";
const ONE_WEEK_S = 7 * 24 * 60 * 60;

export type TokenPayload = { uid: number; role: UserRole };

export function sign(payload: TokenPayload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export function verify(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch {
    return null;
  }
}

export function setAuthCookie(res: NextResponse, payload: TokenPayload) {
  res.cookies.set(COOKIE_NAME, sign(payload), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: ONE_WEEK_S,
    path: "/",
  });
}

export function clearAuthCookie(res: NextResponse) {
  res.cookies.set(COOKIE_NAME, "", { httpOnly: true, maxAge: 0, path: "/" });
}

export function readAuthFromRequest(req: NextRequest): TokenPayload | null {
  const raw = req.cookies.get(COOKIE_NAME)?.value;
  if (!raw) return null;
  return verify(raw);
}

/** For server components / route handlers that use next/headers. */
export function readAuth(): TokenPayload | null {
  const raw = cookies().get(COOKIE_NAME)?.value;
  if (!raw) return null;
  return verify(raw);
}

export type AuthUser = NonNullable<Awaited<ReturnType<typeof loadUser>>>;

export async function loadUser(uid: number) {
  return prisma.user.findUnique({
    where: { userId: uid },
    include: { stats: true, store: true },
  });
}

export async function requireAuth(
  req: NextRequest,
  roles?: UserRole[],
): Promise<{ ok: true; auth: TokenPayload; user: AuthUser } | { ok: false; response: NextResponse }> {
  const auth = readAuthFromRequest(req);
  if (!auth) return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const user = await loadUser(auth.uid);
  // Soft-deleted users still hold their JWT cookie until it expires —
  // explicitly bounce them as Unauthorized so old sessions can't be
  // resurrected after an admin removes the account.
  if (!user || user.deletedAt) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  // Role check uses the **DB** role, not the role baked into the JWT —
  // otherwise a promotion/demotion forces the user to log out + back in
  // before the change takes effect (and an admin demoted to seller can't
  // even reach /admin to undo their mistake). Returns the live role to
  // callers via `auth.role`.
  const liveRole = (user.stats?.role ?? "buyer") as UserRole;
  if (roles && !roles.includes(liveRole)) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden", need: roles }, { status: 403 }) };
  }
  return { ok: true, auth: { uid: auth.uid, role: liveRole }, user };
}

export function json<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function err(code: string, message?: string, status = 400) {
  return NextResponse.json({ error: code, ...(message ? { message } : {}) }, { status });
}
