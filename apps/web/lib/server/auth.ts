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
  if (roles && !roles.includes(auth.role)) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden", need: roles }, { status: 403 }) };
  }
  const user = await loadUser(auth.uid);
  if (!user) return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  return { ok: true, auth, user };
}

export function json<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function err(code: string, message?: string, status = 400) {
  return NextResponse.json({ error: code, ...(message ? { message } : {}) }, { status });
}
