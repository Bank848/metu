import { cookies } from "next/headers";
import { readAuth, loadUser } from "./server/auth";

/**
 * Server-side auth — read JWT cookie, load user from Prisma directly.
 * No HTTP roundtrip, works the same on Vercel and local dev.
 */
export async function getMe() {
  const auth = readAuth();
  if (!auth) return null;
  const user = await loadUser(auth.uid);
  // Soft-deleted users are surfaced as logged-out — page renders the
  // public/anonymous variant rather than a half-broken authed state.
  if (!user || (user as any).deletedAt) return null;
  const { password: _, ...safe } = user as any;
  // Prefer the DB role (always current) over the JWT role (stale until
  // re-login). If for some reason stats are missing, fall back to JWT
  // and finally to "buyer" so the type is still narrow.
  const role = ((safe.stats?.role as string | undefined) ?? auth.role ?? "buyer") as typeof auth.role;
  return { user: safe, role };
}

/**
 * Authenticated server-side fetch — forwards the user cookie when calling
 * an internal /api endpoint. Falls back gracefully on errors.
 *
 * NOTE: prefer importing from `lib/server/queries` for catalog reads where
 * possible — direct Prisma is faster and avoids URL-base detection. This
 * helper is kept for cart/orders/seller/admin endpoints that have richer
 * auth/business logic still living in the route handlers.
 */
export async function apiAuth<T = unknown>(path: string, init?: RequestInit): Promise<T | null> {
  const cookie = cookies().toString();
  const base = absoluteBase();
  const url = `${base}${path.startsWith("/api/") ? path : "/api" + (path.startsWith("/") ? path : "/" + path)}`;
  try {
    const res = await fetch(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        cookie,
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });
    if (res.status === 401 || res.status === 403 || res.status === 404) return null;
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function absoluteBase(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}
